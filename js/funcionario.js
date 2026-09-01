// js/funcionario.js

document.addEventListener('DOMContentLoaded', async () => {
    const usuarioString = sessionStorage.getItem('usuarioLogado');
    if (!usuarioString) { window.location.href = 'index.html'; return; }
    
    const usuario = JSON.parse(usuarioString);
    if (usuario.role !== 'employee' && usuario.role !== 'admin') { 
        window.location.href = 'index.html'; 
        return; 
    }

    document.getElementById('nome-funcionario').textContent = `Olá, ${usuario.nome.split(' ')[0]}`;
    document.getElementById('cargo-funcionario').textContent = usuario.cargo || 'Funcionário';
    if (usuario.foto) document.getElementById('foto-perfil').src = usuario.foto;

    const containerFoto = document.getElementById('container-foto-funcionario');
    const inputFoto = document.getElementById('input-foto-funcionario');
    const imgFoto = document.getElementById('foto-perfil');

    if (containerFoto && inputFoto && imgFoto) {
        containerFoto.addEventListener('click', () => inputFoto.click());
        inputFoto.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 1024 * 1024) {
                mostrarMensagem('⚠️ A imagem é muito grande! Escolha uma foto com menos de 1MB.', 'erro');
                return;
            }
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target.result;
                imgFoto.style.opacity = '0.5';
                try {
                    const { error } = await window.bancoDeDados.from('funcionarios').update({ foto_url: base64String }).eq('id', usuario.id);
                    if (error) throw error;
                    imgFoto.src = base64String;
                    usuario.foto = base64String;
                    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuario));
                    mostrarMensagem('📸 Foto atualizada com sucesso!', 'sucesso');
                } catch (err) { mostrarMensagem('❌ Erro ao salvar a foto.', 'erro'); } 
                finally { imgFoto.style.opacity = '1'; }
            };
            reader.readAsDataURL(file);
        });
    }

    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    carregarHistorico(usuario.id);

    document.getElementById('btn-clock-in').addEventListener('click', () => registrarPonto('entrada', usuario.id));
    document.getElementById('btn-clock-out').addEventListener('click', () => registrarPonto('saida', usuario.id));
});

function atualizarRelogio() {
    // Relógio sempre no horário de Portugal (Europe/Lisbon), ignorando o fuso do dispositivo.
    const agora = window.obterHorarioPortugal();
    document.getElementById('relogio').textContent = agora.horaFormatada;
    const dataObj = new Date(`${agora.dataISO}T12:00:00`);
    const opcoesData = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('data-atual').textContent = dataObj.toLocaleDateString('pt-BR', opcoesData);
}

function mostrarMensagem(texto, tipo) {
    const msgDiv = document.getElementById('mensagem-status');
    msgDiv.innerHTML = texto;
    msgDiv.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'bg-emerald-50', 'text-emerald-700');
    if (tipo === 'erro') msgDiv.classList.add('bg-red-50', 'text-red-600');
    else msgDiv.classList.add('bg-emerald-50', 'text-emerald-700');
    setTimeout(() => { msgDiv.classList.add('hidden'); }, 6000);
}

window.fazerLogout = function() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
};

async function registrarPonto(tipo, funcionarioId) {
    try {
        const { data: funcDados, error: errFunc } = await window.bancoDeDados.from('funcionarios').select('horario_entrada, horario_saida').eq('id', funcionarioId).single();
        if (errFunc) throw new Error('Erro ao buscar regras de horário.');

        // Horário fixo de Portugal (Figueira da Foz - Europe/Lisbon), não do dispositivo.
        const agora = window.obterHorarioPortugal();
        const horaAtualMinutos = agora.minutosDoDia;

        if (tipo === 'entrada' && funcDados.horario_entrada) {
            const [hEntrada, mEntrada] = funcDados.horario_entrada.split(':').map(Number);
            const minEntradaOficial = (hEntrada * 60) + mEntrada;
            let diff = horaAtualMinutos - minEntradaOficial;
            if (diff < -720) diff += 1440; if (diff > 720) diff -= 1440;

            if (diff < -20 || diff > 20) {
                mostrarMensagem(`⏰ Fora do horário! Seu Clock In é às ${funcDados.horario_entrada}. Você só pode registrar 20 minutos antes ou depois.`, 'erro');
                return;
            }
        } 
        else if (tipo === 'saida' && funcDados.horario_saida) {
            const [hSaida, mSaida] = funcDados.horario_saida.split(':').map(Number);
            const minSaidaOficial = (hSaida * 60) + mSaida;
            let diff = horaAtualMinutos - minSaidaOficial;
            if (diff < -720) diff += 1440; if (diff > 720) diff -= 1440;

            // Limite mínimo: 20 minutos ANTES do horário de saída (tolerância).
            if (diff < -20) {
                const limiteMin = minSaidaOficial - 20;
                const hLim = Math.floor(limiteMin / 60) % 24;
                const mLim = limiteMin % 60;
                mostrarMensagem(`⏰ Muito cedo! Você não pode bater a saída antes das ${String(hLim).padStart(2,'0')}:${String(mLim).padStart(2,'0')}.`, 'erro');
                return;
            }
            // Clock Out permite até 20 minutos DEPOIS do horário (tolerância).
            // Acima de 20 minutos, só o Administrador pode registrar (hora extra).
            if (diff > 20) {
                mostrarMensagem(`⏰ Expediente encerrado! Apenas o Administrador pode registrar saídas com Hora Extra no painel.`, 'erro');
                return;
            }
        }

        // Data de hoje no fuso de Portugal (para a coluna data_registro).
        const hoje = agora.dataISO; 
        const { data: registroHoje } = await window.bancoDeDados.from('registros_ponto').select('*').eq('funcionario_id', funcionarioId).eq('data_registro', hoje).single();

        if (tipo === 'entrada') {
            if (registroHoje && registroHoje.clock_in) return mostrarMensagem('⚠️ Você já fez Clock In hoje!', 'erro');
            await window.bancoDeDados.from('registros_ponto').insert([{ funcionario_id: funcionarioId, data_registro: hoje, clock_in: agora.timestampISO, inserido_por_admin: false }]);
            mostrarMensagem('✅ CLOCK IN registrado com sucesso!', 'sucesso');
            
        } else if (tipo === 'saida') {
            if (!registroHoje || !registroHoje.clock_in) return mostrarMensagem('⚠️ Você precisa fazer Clock In antes de fazer Clock Out.', 'erro');
            if (registroHoje.clock_out) return mostrarMensagem('⚠️ Você já fez Clock Out hoje!', 'erro');
            await window.bancoDeDados.from('registros_ponto').update({ clock_out: agora.timestampISO }).eq('id', registroHoje.id);
            mostrarMensagem('✅ CLOCK OUT registrado com sucesso!', 'sucesso');
        }

        await window.bancoDeDados.from('logs_atividade').insert([{ usuario_id: funcionarioId, acao: tipo === 'entrada' ? 'Clock In' : 'Clock Out', timestamp: agora.timestampISO }]);
        carregarHistorico(funcionarioId);

    } catch (error) { mostrarMensagem('❌ Ocorreu um erro ao processar o ponto.', 'erro'); }
}

async function carregarHistorico(funcionarioId) {
    // Mês atual no horário de Portugal (não do dispositivo).
    const hojePT = window.obterHorarioPortugal();
    const [ano, mes] = hojePT.dataISO.split('-');
    const primeiroDia = `${ano}-${mes}-01`;
    const ultimoDiaNum = new Date(Number(ano), Number(mes), 0).getDate();
    const ultimoDia = `${ano}-${mes}-${String(ultimoDiaNum).padStart(2, '0')}`;

    const lista = document.getElementById('lista-historico');
    const { data: registros, error } = await window.bancoDeDados.from('registros_ponto').select('*').eq('funcionario_id', funcionarioId).gte('data_registro', primeiroDia).lte('data_registro', ultimoDia).order('data_registro', { ascending: false });

    if (error || !registros || registros.length === 0) {
        lista.innerHTML = '<p class="text-slate-500 text-center text-sm font-medium py-4">Nenhum registro encontrado neste mês.</p>';
        return;
    }

    lista.innerHTML = ''; 
    registros.forEach(reg => {
        const dataFormatada = new Date(reg.data_registro + 'T12:00:00').toLocaleDateString('pt-BR');
        // Horas sempre exibidas no fuso de Portugal, independentemente do dispositivo.
        const inPT = window.converterTimestampPortugal(reg.clock_in);
        const outPT = window.converterTimestampPortugal(reg.clock_out);
        const horaEntrada = inPT ? inPT.horaFormatada : '--:--';
        const horaSaida = outPT ? outPT.horaFormatada : '--:--';

        lista.innerHTML += `
            <div class="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 gap-2 sm:gap-4 hover:shadow-sm transition">
                <div class="font-bold text-slate-700 bg-white px-3 py-1 border border-slate-200 rounded text-sm sm:text-base">${dataFormatada}</div>
                <div class="flex gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
                    <div class="flex items-center gap-1 sm:gap-2"><span class="text-emerald-500 text-sm sm:text-lg">🟢</span><span class="text-slate-600 font-bold text-sm sm:text-base">In: ${horaEntrada}</span></div>
                    <div class="flex items-center gap-1 sm:gap-2"><span class="text-slate-600 font-bold text-sm sm:text-base">Out: ${horaSaida}</span><span class="text-orange-500 text-sm sm:text-lg">🔴</span></div>
                </div>
            </div>`;
    });
}