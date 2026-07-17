// js/funcionario.js

document.addEventListener('DOMContentLoaded', async () => {
    const usuarioString = sessionStorage.getItem('usuarioLogado');
    if (!usuarioString) { window.location.href = 'index.html'; return; }
    
    const usuario = JSON.parse(usuarioString);
    
    // Aceita tanto employee quanto admin (caso um admin queira bater ponto também)
    if (usuario.role !== 'employee' && usuario.role !== 'admin') { 
        window.location.href = 'index.html'; 
        return; 
    }

    document.getElementById('nome-funcionario').textContent = `Olá, ${usuario.nome.split(' ')[0]}`;
    document.getElementById('cargo-funcionario').textContent = usuario.cargo || 'Funcionário';
    if (usuario.foto) document.getElementById('foto-perfil').src = usuario.foto;

    // --- NOVA LÓGICA: UPLOAD DE FOTO DO FUNCIONÁRIO ---
    const containerFoto = document.getElementById('container-foto-funcionario');
    const inputFoto = document.getElementById('input-foto-funcionario');
    const imgFoto = document.getElementById('foto-perfil');

    if (containerFoto && inputFoto && imgFoto) {
        containerFoto.addEventListener('click', () => inputFoto.click());

        inputFoto.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Regra de Ouro: Limite de 1MB para não travar o banco de dados
            if (file.size > 1024 * 1024) {
                mostrarMensagem('⚠️ A imagem é muito grande! Escolha uma foto com menos de 1MB.', 'erro');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64String = event.target.result;
                imgFoto.style.opacity = '0.5';

                try {
                    // Salva diretamente no Supabase
                    const { error } = await window.bancoDeDados
                        .from('funcionarios')
                        .update({ foto_url: base64String })
                        .eq('id', usuario.id);

                    if (error) throw error;

                    // Atualiza a tela e a sessão
                    imgFoto.src = base64String;
                    usuario.foto = base64String;
                    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuario));
                    mostrarMensagem('📸 Foto atualizada com sucesso!', 'sucesso');

                } catch (err) {
                    console.error(err);
                    mostrarMensagem('❌ Erro ao salvar a foto.', 'erro');
                } finally {
                    imgFoto.style.opacity = '1';
                }
            };
            reader.readAsDataURL(file);
        });
    }
    // --- FIM DA LÓGICA DE FOTO ---

    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    carregarHistorico(usuario.id);

    document.getElementById('btn-clock-in').addEventListener('click', () => registrarPonto('entrada', usuario.id));
    document.getElementById('btn-clock-out').addEventListener('click', () => registrarPonto('saida', usuario.id));
});

function atualizarRelogio() {
    const agora = new Date();
    const opcoesData = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('data-atual').textContent = agora.toLocaleDateString('pt-BR', opcoesData);
    
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const segundos = String(agora.getSeconds()).padStart(2, '0');
    document.getElementById('relogio').textContent = `${horas}:${minutos}:${segundos}`;
}

function mostrarMensagem(texto, tipo) {
    const msgDiv = document.getElementById('mensagem-status');
    msgDiv.innerHTML = texto;
    msgDiv.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'bg-emerald-50', 'text-emerald-700');
    
    if (tipo === 'erro') {
        msgDiv.classList.add('bg-red-50', 'text-red-600');
    } else {
        msgDiv.classList.add('bg-emerald-50', 'text-emerald-700');
    }
    
    // O aviso some sozinho após 6 segundos, mas o usuário NÃO é deslogado
    setTimeout(() => { msgDiv.classList.add('hidden'); }, 6000);
}

function calcularDiferencaMinutos(minutosAtual, minutosOficial) {
    let diff = Math.abs(minutosAtual - minutosOficial);
    if (diff > 720) diff = 1440 - diff;
    return diff;
}

async function registrarPonto(tipo, funcionarioId) {
    try {
        const { data: funcDados, error: errFunc } = await window.bancoDeDados.from('funcionarios').select('horario_entrada, horario_saida').eq('id', funcionarioId).single();
        if (errFunc) throw new Error('Erro ao buscar regras de horário.');

        const agora = new Date();
        const horaAtualMinutos = (agora.getHours() * 60) + agora.getMinutes();
        const tolerancia = 20; 

        if (tipo === 'entrada' && funcDados.horario_entrada) {
            const [hEntrada, mEntrada] = funcDados.horario_entrada.split(':').map(Number);
            const minutosEntradaOficial = (hEntrada * 60) + mEntrada;
            if (calcularDiferencaMinutos(horaAtualMinutos, minutosEntradaOficial) > tolerancia) {
                mostrarMensagem(`⏰ Fora do horário! Seu Clock In é às ${String(hEntrada).padStart(2,'0')}:${String(mEntrada).padStart(2,'0')}. Você só pode registrar ${tolerancia} minutos antes ou depois.`, 'erro');
                return;
            }
        } 
        else if (tipo === 'saida' && funcDados.horario_saida) {
            const [hSaida, mSaida] = funcDados.horario_saida.split(':').map(Number);
            const minutosSaidaOficial = (hSaida * 60) + mSaida;
            if (calcularDiferencaMinutos(horaAtualMinutos, minutosSaidaOficial) > tolerancia) {
                mostrarMensagem(`⏰ Fora do horário! Seu Clock Out é às ${String(hSaida).padStart(2,'0')}:${String(mSaida).padStart(2,'0')}. Você só pode registrar ${tolerancia} minutos antes ou depois.`, 'erro');
                return;
            }
        }

        const hoje = agora.toLocaleDateString('en-CA'); 
        const { data: registroHoje } = await window.bancoDeDados.from('registros_ponto').select('*').eq('funcionario_id', funcionarioId).eq('data_registro', hoje).single();

        if (tipo === 'entrada') {
            if (registroHoje && registroHoje.clock_in) return mostrarMensagem('⚠️ Você já fez Clock In hoje!', 'erro');
            
            await window.bancoDeDados.from('registros_ponto').insert([{ funcionario_id: funcionarioId, data_registro: hoje, clock_in: agora.toISOString(), inserido_por_admin: false }]);
            mostrarMensagem('✅ CLOCK IN registrado com sucesso!', 'sucesso');
            
        } else if (tipo === 'saida') {
            if (!registroHoje || !registroHoje.clock_in) return mostrarMensagem('⚠️ Você precisa fazer Clock In antes de fazer Clock Out.', 'erro');
            if (registroHoje.clock_out) return mostrarMensagem('⚠️ Você já fez Clock Out hoje!', 'erro');

            await window.bancoDeDados.from('registros_ponto').update({ clock_out: agora.toISOString() }).eq('id', registroHoje.id);
            mostrarMensagem('✅ CLOCK OUT registrado com sucesso!', 'sucesso');
        }

        await window.bancoDeDados.from('logs_atividade').insert([{ usuario_id: funcionarioId, acao: tipo === 'entrada' ? 'Clock In' : 'Clock Out', timestamp: agora.toISOString() }]);
        carregarHistorico(funcionarioId);

    } catch (error) { mostrarMensagem('❌ Ocorreu um erro ao processar o ponto.', 'erro'); }
}

async function carregarHistorico(funcionarioId) {
    const dataAtual = new Date();
    const primeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toLocaleDateString('en-CA');
    const ultimoDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0).toLocaleDateString('en-CA');

    const lista = document.getElementById('lista-historico');
    const { data: registros, error } = await window.bancoDeDados.from('registros_ponto').select('*').eq('funcionario_id', funcionarioId).gte('data_registro', primeiroDia).lte('data_registro', ultimoDia).order('data_registro', { ascending: false });

    if (error || !registros || registros.length === 0) {
        lista.innerHTML = '<p class="text-slate-500 text-center text-sm font-medium py-4">Nenhum registro encontrado neste mês.</p>';
        return;
    }

    lista.innerHTML = ''; 
    registros.forEach(reg => {
        const dataFormatada = new Date(reg.data_registro + 'T12:00:00').toLocaleDateString('pt-BR');
        const horaEntrada = reg.clock_in ? new Date(reg.clock_in).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--';
        const horaSaida = reg.clock_out ? new Date(reg.clock_out).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--';

        lista.innerHTML += `
            <div class="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200 gap-4 hover:shadow-sm transition">
                <div class="font-bold text-slate-700 bg-white px-3 py-1 border border-slate-200 rounded">${dataFormatada}</div>
                <div class="flex gap-6">
                    <div class="flex items-center gap-2"><span class="text-emerald-500 text-lg">🟢</span><span class="text-slate-600 font-bold">In: ${horaEntrada}</span></div>
                    <div class="flex items-center gap-2"><span class="text-slate-600 font-bold">Out: ${horaSaida}</span><span class="text-orange-500 text-lg">🔴</span></div>
                </div>
            </div>`;
    });
}