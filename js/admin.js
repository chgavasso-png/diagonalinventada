// js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Verificação de Segurança
    const usuarioString = sessionStorage.getItem('usuarioLogado');
    if (!usuarioString) { window.location.href = 'index.html'; return; }
    const usuarioLogado = JSON.parse(usuarioString);
    if (usuarioLogado.role !== 'admin') { window.location.href = 'index.html'; return; }

    document.getElementById('admin-nome').textContent = usuarioLogado.nome;
    if (usuarioLogado.foto) document.getElementById('admin-foto').src = usuarioLogado.foto;

    // --- LÓGICA DO MENU MOBILE ---
    const sidebar = document.getElementById('sidebar');
    const btnOpenSidebar = document.getElementById('btn-open-sidebar');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        sidebarOverlay.classList.toggle('hidden');
    }
    if (btnOpenSidebar) btnOpenSidebar.addEventListener('click', toggleSidebar);
    if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);
    // ---------------------------------

    // Foto do Admin e Logout
    document.getElementById('container-foto-admin').addEventListener('click', () => document.getElementById('input-foto-admin').click());
    document.getElementById('input-foto-admin').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) { alert('A imagem é muito grande! Máx: 1MB.'); return; }
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64String = event.target.result; 
            try {
                await window.bancoDeDados.from('funcionarios').update({ foto_url: base64String }).eq('id', usuarioLogado.id);
                document.getElementById('admin-foto').src = base64String;
                usuarioLogado.foto = base64String;
                sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
            } catch (err) { alert('Erro ao salvar foto.'); }
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('Sair do sistema?')) { sessionStorage.removeItem('usuarioLogado'); window.location.href = 'index.html'; }
    });

    // Navegação SPA
    const abas = ['dashboard', 'funcionarios', 'ponto'];
    function mudarAba(abaAtiva) {
        abas.forEach(aba => {
            const btn = document.getElementById(`nav-${aba}`);
            const sec = document.getElementById(`section-${aba}`);
            if (aba === abaAtiva) {
                sec.classList.remove('hidden');
                btn.classList.add('bg-orange-500', 'text-white', 'shadow-md');
                btn.classList.remove('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
            } else {
                sec.classList.add('hidden');
                btn.classList.remove('bg-orange-500', 'text-white', 'shadow-md');
                btn.classList.add('text-slate-300', 'hover:bg-slate-800', 'hover:text-white');
            }
        });

        if (abaAtiva === 'dashboard') carregarDashboard();
        else if (abaAtiva === 'funcionarios') carregarTabelaFuncionarios();
        else if (abaAtiva === 'ponto') carregarPastasPonto();

        // Fecha menu no mobile
        if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
            toggleSidebar(); 
        }
    }
    document.getElementById('nav-dashboard').addEventListener('click', () => mudarAba('dashboard'));
    document.getElementById('nav-funcionarios').addEventListener('click', () => mudarAba('funcionarios'));
    document.getElementById('nav-ponto').addEventListener('click', () => mudarAba('ponto'));

    async function carregarDashboard() {
        // "Hoje" no fuso de Portugal (não do dispositivo do admin).
        const hojePT = window.obterHorarioPortugal();
        const strHoje = hojePT.dataISO; 
        const dataObj = new Date(`${hojePT.dataISO}T12:00:00`);
        document.getElementById('titulo-presentes').textContent = `🟢 Já Fizeram Clock In (${dataObj.toLocaleDateString('pt-BR')})`;
        try {
            const { data: equipe } = await window.bancoDeDados.from('funcionarios').select('*').eq('status', true);
            const { data: pontosHoje } = await window.bancoDeDados.from('registros_ponto').select('*').eq('data_registro', strHoje);
            const presentes = []; const pendentes = [];
            (equipe || []).forEach(func => {
                const registroFunc = (pontosHoje || []).find(p => p.funcionario_id === func.id);
                if (registroFunc && registroFunc.clock_in) presentes.push({ ...func, clock_in: registroFunc.clock_in, clock_out: registroFunc.clock_out || null });
                else pendentes.push(func);
            });
            document.getElementById('dash-total').textContent = equipe ? equipe.length : 0;
            document.getElementById('dash-presentes').textContent = presentes.length;
            document.getElementById('dash-pendentes').textContent = pendentes.length;
            const semSaida = presentes.filter(p => !p.clock_out);
            document.getElementById('dash-sem-saida').textContent = semSaida.length;
            const ulPresentes = document.getElementById('lista-presentes');
            ulPresentes.innerHTML = presentes.length === 0 ? '<li class="text-slate-500 text-sm">Ninguém bateu ponto ainda.</li>' : '';
            // Reset do filtro para "Todos" a cada atualização do dashboard.
            const btnFt = document.getElementById('btn-filtro-todos');
            const btnFs = document.getElementById('btn-filtro-semsaida');
            if (btnFt && btnFs) {
                btnFt.classList.add('bg-emerald-600', 'text-white'); btnFt.classList.remove('text-slate-600');
                btnFs.classList.remove('bg-amber-500', 'text-white'); btnFs.classList.add('text-slate-600');
            }
            const msgVazia = document.getElementById('msg-semsaida-vazia');
            if (msgVazia) msgVazia.classList.add('hidden');
            presentes.forEach(p => {
                // Hora do Clock In exibida no fuso de Portugal.
                const inPT = window.converterTimestampPortugal(p.clock_in);
                const horaIn = inPT ? inPT.horaFormatada : '--:--';
                const temSaida = !!p.clock_out;
                let blocoSaida, acoes = '';
                if (temSaida) {
                    const outPT = window.converterTimestampPortugal(p.clock_out);
                    const horaOut = outPT ? outPT.horaFormatada : '--:--';
                    blocoSaida = `<div class="bg-rose-100 text-rose-800 font-bold px-3 py-1 rounded text-sm">🔴 ${horaOut}</div>`;
                } else {
                    blocoSaida = `<div class="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded text-sm">🟡 Sem Saída</div>`;
                    acoes = `<button onclick="avisarSaidaFuncionario(this)" class="text-xs text-white bg-amber-500 px-3 py-1 rounded font-bold hover:bg-amber-600 transition">Avisar</button>`;
                    // Botão "Forçar Saída" só aparece quando a hora atual (Portugal)
                    // já passou do horário de saída programado do funcionário.
                    const [sH, sM] = (p.horario_saida || '17:00').split(':').map(Number);
                    const minSaida = (sH || 0) * 60 + (sM || 0);
                    if (hojePT.minutosDoDia >= minSaida) {
                        acoes += `<button onclick="forcarSaidaFuncionario('${p.id}', '${p.nome_completo}', '${p.horario_saida || '17:00'}')" class="text-xs text-white bg-purple-600 px-3 py-1 rounded font-bold hover:bg-purple-700 transition">⚡ Forçar Saída</button>`;
                    }
                }
                ulPresentes.innerHTML += `<li data-tem-saida="${temSaida}" class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg mb-2 shadow-sm"><div class="flex items-center gap-3"><img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-full object-cover"><div><p class="font-bold text-slate-800 text-sm sm:text-base">${p.nome_completo}</p></div></div><div class="flex items-center gap-2"><div class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded text-sm">${horaIn}</div>${blocoSaida}${acoes}</div></li>`;
            });
            const ulPendentes = document.getElementById('lista-pendentes');
            ulPendentes.innerHTML = pendentes.length === 0 ? '<li class="text-slate-500 text-sm">Todos bateram o ponto! 🎉</li>' : '';
            pendentes.forEach(p => {
                ulPendentes.innerHTML += `<li class="flex items-center justify-between p-3 bg-white border-l-4 border-l-red-500 rounded-lg mb-2 shadow-sm"><div class="flex items-center gap-3"><img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full object-cover"><p class="font-bold text-slate-800 text-sm">${p.nome_completo}</p></div><button onclick="avisarFuncionario(this)" class="text-xs text-white bg-orange-500 px-3 py-1 rounded font-bold hover:bg-orange-600 transition">Avisar</button></li>`;
            });
        } catch (error) {}
    }

    window.avisarFuncionario = function(btn) {
        alert('Notificação enviada com sucesso!');
        btn.textContent = '✅ Avisado';
        btn.classList.replace('bg-orange-500', 'bg-emerald-100');
        btn.classList.add('text-emerald-700', 'cursor-default');
        btn.disabled = true;
    };

    // Alterna a lista "Já Fizeram Clock In" entre Todos e Sem Saída (clock out pendente).
    window.filtrarPresentes = function(modo) {
        const btnTodos = document.getElementById('btn-filtro-todos');
        const btnSem = document.getElementById('btn-filtro-semsaida');
        const itens = document.querySelectorAll('#lista-presentes li[data-tem-saida]');
        const msgVazia = document.getElementById('msg-semsaida-vazia');
        if (modo === 'semsaida') {
            btnTodos.classList.remove('bg-emerald-600', 'text-white'); btnTodos.classList.add('text-slate-600');
            btnSem.classList.add('bg-amber-500', 'text-white'); btnSem.classList.remove('text-slate-600');
            let visiveis = 0;
            itens.forEach(li => {
                if (li.dataset.temSaida === 'false') { li.style.display = ''; visiveis++; }
                else { li.style.display = 'none'; }
            });
            if (msgVazia) msgVazia.classList.toggle('hidden', visiveis > 0);
        } else {
            btnSem.classList.remove('bg-amber-500', 'text-white'); btnSem.classList.add('text-slate-600');
            btnTodos.classList.add('bg-emerald-600', 'text-white'); btnTodos.classList.remove('text-slate-600');
            itens.forEach(li => { li.style.display = ''; });
            if (msgVazia) msgVazia.classList.add('hidden');
        }
    };

    window.avisarSaidaFuncionario = function(btn) {
        alert('Lembrete de Clock Out enviado com sucesso!');
        btn.textContent = '✅ Avisado';
        btn.classList.replace('bg-amber-500', 'bg-emerald-100');
        btn.classList.add('text-emerald-700', 'cursor-default');
        btn.disabled = true;
    };

    // Força o Clock Out de um funcionário para o dia de hoje, registrando a
    // saída no horário programado (horario_saida). Só é visível no dashboard
    // quando a hora atual de Portugal já passou desse horário. Atualiza APENAS
    // o registo da pessoa selecionada (filtro por funcionario_id + id).
    window.forcarSaidaFuncionario = async function(id, nome, horarioSaida) {
        if (!id) { alert('Funcionário inválido.'); return; }
        const saidaCurta = (horarioSaida || '17:00').slice(0, 5); // 'HH:mm'
        if (!confirm(`Forçar Clock Out de ${nome}?\n\nSerá registrado o horário de saída programado: ${saidaCurta}.`)) return;
        try {
            const strHoje = window.obterHorarioPortugal().dataISO;
            const timestamp = window.comporTimestampPortugal(strHoje, saidaCurta);
            const { data: registro } = await window.bancoDeDados.from('registros_ponto')
                .select('id').eq('funcionario_id', id).eq('data_registro', strHoje).single();
            if (!registro) { alert('Registo de hoje não encontrado. O funcionário precisa fazer Clock In primeiro.'); return; }
            await window.bancoDeDados.from('registros_ponto')
                .update({ clock_out: timestamp, inserido_por_admin: true }).eq('id', registro.id);
            alert('✅ Clock Out forçado com sucesso!');
            carregarDashboard();
        } catch (err) { alert('Erro ao forçar o Clock Out.'); }
    };

    let fotoBase64Temporaria = null; 
    async function carregarTabelaFuncionarios() {
        const tbody = document.getElementById('tabela-funcionarios');
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-500">Buscando dados...</td></tr>';
        try {
            const { data } = await window.bancoDeDados.from('funcionarios').select('*').order('nome_completo');
            window.funcionariosData = data;
            tbody.innerHTML = '';
            data.forEach(func => {
                const foto = func.foto_url || 'https://via.placeholder.com/150';
                const badgeRole = func.role === 'admin' ? `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">Admin</span>` : `<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">Padrão</span>`;
                let btnExcluir = func.id !== usuarioLogado.id ? `<button onclick="excluirFuncionario('${func.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Excluir">🗑️</button>` : '';
                tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-3 sm:p-4 flex items-center gap-3"><img src="${foto}" class="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-sm"><div><p class="font-bold text-slate-800 text-sm sm:text-base">${func.nome_completo}</p></div></td><td class="p-3 sm:p-4 font-mono text-xs sm:text-sm text-slate-600">${func.matricula}</td><td class="p-3 sm:p-4 text-center hidden sm:table-cell">${badgeRole}</td><td class="p-3 sm:p-4 text-center flex justify-center gap-1"><button onclick="abrirModalForcar('${func.id}', '${func.nome_completo}')" class="text-purple-600 hover:bg-purple-100 p-2 rounded transition" title="Forçar Ponto Manual">⚡</button><button onclick="abrirModalSenha('${func.id}', '${func.nome_completo}')" class="text-yellow-600 hover:bg-yellow-100 p-2 rounded transition" title="Alterar Senha do Funcionário">🔑</button><button onclick="abrirModalEdicao('${func.id}')" class="text-slate-500 hover:bg-slate-200 p-2 rounded transition" title="Editar Perfil">✏️</button>${btnExcluir}</td></tr>`;
            });
        } catch (err) {}
    }

    document.getElementById('func-foto-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) return alert('Foto muito grande! Máx: 1MB.');
        const reader = new FileReader();
        reader.onload = (event) => { fotoBase64Temporaria = event.target.result; document.getElementById('func-foto-preview').src = fotoBase64Temporaria; };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-novo-funcionario').addEventListener('click', () => {
        document.getElementById('form-funcionario').reset();
        document.getElementById('func-id').value = '';
        fotoBase64Temporaria = null;
        document.getElementById('func-foto-preview').src = 'https://via.placeholder.com/150';
        document.getElementById('modal-titulo').textContent = 'Novo Funcionário';
        document.getElementById('modal-funcionario').classList.replace('hidden', 'flex');
    });

    window.abrirModalEdicao = function(id) {
        const func = window.funcionariosData.find(f => f.id === id);
        if (!func) return;
        document.getElementById('func-id').value = func.id;
        document.getElementById('func-nome').value = func.nome_completo;
        document.getElementById('func-matricula').value = func.matricula;
        document.getElementById('func-pin').value = func.pin_hash;
        document.getElementById('func-cargo').value = func.cargo || '';
        document.getElementById('func-whatsapp').value = func.whatsapp || ''; // Puxa WhatsApp
        document.getElementById('func-role').value = func.role;
        document.getElementById('func-entrada').value = func.horario_entrada || '08:00';
        document.getElementById('func-saida').value = func.horario_saida || '17:00';
        document.getElementById('func-almoco-inicio').value = func.horario_almoco_inicio || '13:00';
        document.getElementById('func-almoco-fim').value = func.horario_almoco_fim || '14:00';
        fotoBase64Temporaria = func.foto_url || null;
        document.getElementById('func-foto-preview').src = fotoBase64Temporaria || 'https://via.placeholder.com/150';
        document.getElementById('modal-titulo').textContent = 'Editar Funcionário';
        document.getElementById('modal-funcionario').classList.replace('hidden', 'flex');
    };

    document.getElementById('form-funcionario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('func-id').value;
        const dados = {
            nome_completo: document.getElementById('func-nome').value, 
            matricula: document.getElementById('func-matricula').value.trim().toLowerCase(),
            pin_hash: document.getElementById('func-pin').value, 
            cargo: document.getElementById('func-cargo').value, 
            whatsapp: document.getElementById('func-whatsapp').value.trim(), // Salva WhatsApp
            role: document.getElementById('func-role').value,
            horario_entrada: document.getElementById('func-entrada').value, 
            horario_saida: document.getElementById('func-saida').value,
            horario_almoco_inicio: document.getElementById('func-almoco-inicio').value || '13:00',
            horario_almoco_fim: document.getElementById('func-almoco-fim').value || '14:00',
            status: true
        };
        if (fotoBase64Temporaria) dados.foto_url = fotoBase64Temporaria; 
        try {
            if (id) {
                const { error } = await window.bancoDeDados.from('funcionarios').update(dados).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await window.bancoDeDados.from('funcionarios').insert([dados]);
                if (error) throw error;
            }
            alert('Salvo com sucesso!');
            document.getElementById('modal-funcionario').classList.replace('flex', 'hidden');
            carregarTabelaFuncionarios(); carregarDashboard();
        } catch (err) { alert('Erro ao salvar: ' + (err.message || 'Verifique conexão.')); }
    });

    window.excluirFuncionario = async function(id) {
        if (!confirm('Excluir este funcionário apagará os dados de ponto dele. Continuar?')) return;
        try { await window.bancoDeDados.from('funcionarios').delete().eq('id', id); carregarTabelaFuncionarios(); } catch (err) {}
    };

    window.abrirModalSenha = function(id, nome) {
        document.getElementById('senha-id').value = id;
        document.getElementById('senha-nome').textContent = `Usuário: ${nome}`;
        document.getElementById('senha-nova').value = '';
        document.getElementById('modal-mudar-senha').classList.replace('hidden', 'flex');
    };

    window.abrirModalSenhaAdmin = function() {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado'));
        abrirModalSenha(u.id, u.nome + ' (Sua Conta)');
    };

    document.getElementById('form-mudar-senha').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await window.bancoDeDados.from('funcionarios').update({ pin_hash: document.getElementById('senha-nova').value }).eq('id', document.getElementById('senha-id').value);
            alert('Senha alterada!');
            document.getElementById('modal-mudar-senha').classList.replace('flex', 'hidden');
            carregarTabelaFuncionarios();
        } catch (err) { alert('Erro.'); }
    });

    window.abrirModalForcar = function(id, nome) {
        document.getElementById('forcar-id').value = id; document.getElementById('forcar-nome').textContent = nome;
        // Pré-preenche a data com "hoje" no horário de Portugal.
        document.getElementById('forcar-data').value = window.obterHorarioPortugal().dataISO;
        document.getElementById('modal-forcar-ponto').classList.replace('hidden', 'flex');
    };

    document.getElementById('form-forcar-ponto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('forcar-id').value; const dataStr = document.getElementById('forcar-data').value;
        const tipo = document.getElementById('forcar-tipo').value; const horaStr = document.getElementById('forcar-hora').value;
        // Guarda de segurança: o id do funcionário é obrigatório para garantir
        // que o ponto forçado afete APENAS a pessoa selecionada (nunca todos).
        if (!id) { alert('Nenhum funcionário selecionado. Feche o modal e tente novamente.'); return; }
        if (!dataStr || !horaStr) { alert('Preencha a data e o horário.'); return; }
        // Compõe o timestamp interpretando a data/hora como horário de Portugal.
        const timestamp = window.comporTimestampPortugal(dataStr, horaStr);
        try {
            const { data: registro } = await window.bancoDeDados.from('registros_ponto').select('id').eq('funcionario_id', id).eq('data_registro', dataStr).single();
            if (registro) {
                const updateObj = tipo === 'entrada' ? { clock_in: timestamp, inserido_por_admin: true } : { clock_out: timestamp, inserido_por_admin: true };
                await window.bancoDeDados.from('registros_ponto').update(updateObj).eq('id', registro.id);
            } else {
                const insertObj = { funcionario_id: id, data_registro: dataStr, inserido_por_admin: true };
                tipo === 'entrada' ? insertObj.clock_in = timestamp : insertObj.clock_out = timestamp;
                await window.bancoDeDados.from('registros_ponto').insert([insertObj]);
            }
            alert('Ponto forçado com sucesso!');
            document.getElementById('modal-forcar-ponto').classList.replace('flex', 'hidden');
        } catch (err) { alert('Erro.'); }
    });

    const inputMesAno = document.getElementById('ponto-mes-ano');
    // Mês atual no horário de Portugal (não do dispositivo).
    const hojeMes = window.obterHorarioPortugal();
    const partesHoje = hojeMes.dataISO.split('-');
    inputMesAno.value = `${partesHoje[0]}-${partesHoje[1]}`;
    inputMesAno.addEventListener('change', carregarPastasPonto);

    async function carregarPastasPonto() {
        const divPastas = document.getElementById('lista-pastas-ponto');
        divPastas.innerHTML = '<p class="text-slate-500">Buscando pastas da equipe...</p>';
        try {
            const { data: funcionarios } = await window.bancoDeDados.from('funcionarios').select('id, nome_completo, foto_url').order('nome_completo');
            divPastas.innerHTML = '';
            funcionarios.forEach(func => {
                divPastas.innerHTML += `
                    <div class="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col items-center text-center gap-3 transition hover:shadow-md hover:border-orange-300">
                        <img src="${func.foto_url || 'https://via.placeholder.com/150'}" class="w-16 h-16 rounded-full object-cover shadow-sm">
                        <div><h4 class="font-bold text-slate-800">${func.nome_completo}</h4><p class="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest mt-1">Pasta Mensal</p></div>
                        <div class="w-full mt-2 space-y-2">
                            <button onclick="abrirRelatorioTela('${func.id}', '${func.nome_completo}')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition"><span>👁️</span> Ver Relatório</button>
                            <button onclick="baixarRelatorioExcel('${func.id}', '${func.nome_completo}')" class="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition"><span>📊</span> Baixar Excel</button>
                        </div>
                    </div>`;
            });
        } catch (err) {}
    }

    function formatarTempo(totalMinutos) {
        if (totalMinutos <= 0) return '0m';
        const d = Math.floor(totalMinutos / 1440);
        const h = Math.floor((totalMinutos % 1440) / 60);
        const m = Math.floor(totalMinutos % 60);
        let str = '';
        if (d > 0) str += `${d}d, `;
        if (h > 0) str += `${h}h `;
        str += `${m}m`;
        return str;
    }
    // Formata minutos em HH:MM:SS (floored ao segundo, sem frações/millisegundos).
    // Minutos e segundos sempre com 2 dígitos; as horas usam padStart(2) para
    // "sempre 2 dígitos" no caso comum (ex.: 08:00:00) mas crescem sem limite
    // para totais mensais grandes (ex.: 168:00:00 num mês completo).
    function formatarHoraMinSeg(totalMinutos) {
        const totalSeg = Math.floor((totalMinutos || 0) * 60);
        const h = Math.floor(totalSeg / 3600);
        const m = Math.floor((totalSeg % 3600) / 60);
        const s = totalSeg % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    window.abrirRelatorioTela = async function(idFuncionario, nomeFuncionario) {
        const mesAno = document.getElementById('ponto-mes-ano').value;
        if (!mesAno) return alert('Selecione um mês!');
        const [ano, mes] = mesAno.split('-');
        const primeiroDiaStr = `${ano}-${mes}-01`;
        // Último dia do mês (usa 0 como dia = último dia do mês anterior ao informado).
        const ultimoDiaNumero = new Date(Number(ano), Number(mes), 0).getDate();
        const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDiaNumero).padStart(2, '0')}`;

        document.getElementById('relatorio-tela-nome').textContent = nomeFuncionario;
        document.getElementById('relatorio-tela-mes').textContent = `Período: ${mesAno}`;
        const tbody = document.getElementById('tabela-relatorio-tela');
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">Processando cálculos...</td></tr>';
        document.getElementById('modal-ver-relatorio').classList.replace('hidden', 'flex');

        try {
            const { data: funcDados } = await window.bancoDeDados.from('funcionarios').select('horario_entrada, horario_saida, horario_almoco_inicio, horario_almoco_fim').eq('id', idFuncionario).single();
            const { data: registros } = await window.bancoDeDados.from('registros_ponto').select('*').eq('funcionario_id', idFuncionario).gte('data_registro', primeiroDiaStr).lte('data_registro', ultimoDiaStr);

            function minFromHHMM(v, dflt) { const t = v || dflt; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
            const minAlmoco = Math.max(0, minFromHHMM(funcDados.horario_almoco_fim, '14:00') - minFromHHMM(funcDados.horario_almoco_inicio, '13:00'));

            document.getElementById('relatorio-tela-mes').textContent = `Período: ${mesAno} | Horário: ${funcDados.horario_entrada || '08:00'}-${funcDados.horario_saida || '17:00'} | Almoço: ${funcDados.horario_almoco_inicio || '13:00'}-${funcDados.horario_almoco_fim || '14:00'}`;
            tbody.innerHTML = '';
            let totalAtraso = 0, totalExtra = 0, totalTrabalhado = 0;

            for (let d = 1; d <= ultimoDiaNumero; d++) {
                const dataISO = `${ano}-${mes}-${String(d).padStart(2, '0')}`;
                const dataBR = `${String(d).padStart(2, '0')}/${mes}`;
                const reg = (registros || []).find(r => r.data_registro === dataISO);
                
                let inTime = '--:--', outTime = '--:--', atraso = 0, extra = 0, trabalhado = 0;
                let status = '<span class="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] sm:text-xs">Vazio</span>';

                if (reg) {
                    // Conversão das horas para o fuso de Portugal (ignora o fuso do dispositivo).
                    const inPT = window.converterTimestampPortugal(reg.clock_in);
                    const outPT = window.converterTimestampPortugal(reg.clock_out);
                    if (inPT) {
                        inTime = inPT.horaFormatada;
                        const [hE, mE] = (funcDados.horario_entrada || '08:00').split(':').map(Number);
                        const diff = inPT.minutosDoDia - (hE * 60 + mE);
                        // Atraso só conta acima de 20 min de tolerância.
                        if (diff > 20) atraso = diff;
                    }
                    if (outPT) {
                        outTime = outPT.horaFormatada;
                        const [hS, mS] = (funcDados.horario_saida || '17:00').split(':').map(Number);
                        const diff = outPT.minutosDoDia - (hS * 60 + mS);
                        // Hora extra só conta acima de 20 min de tolerância.
                        if (diff > 20) extra = diff;
                        if (inPT) {
                            // Tempo trabalhado descontando o almoço (em minutos, independente de fuso).
                            const totalMin = (new Date(reg.clock_out) - new Date(reg.clock_in)) / 60000;
                            trabalhado = Math.max(0, totalMin - minAlmoco);
                        }
                    }
                    status = reg.clock_in && reg.clock_out ? '<span class="text-emerald-600 font-bold">✅</span>' : '🔄';
                }
                totalAtraso += atraso; totalExtra += extra; totalTrabalhado += trabalhado;
                
                // Só exibe linhas que têm algum registro para não poluir
                if (reg) {
                    tbody.innerHTML += `<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-3 sm:p-4 font-medium text-slate-600">${dataBR}</td><td class="p-3 sm:p-4 text-center font-mono">${inTime}</td><td class="p-3 sm:p-4 text-center font-mono">${outTime}</td><td class="p-3 sm:p-4 text-center text-red-600 font-bold">${atraso > 0 ? atraso + 'm' : '--'}</td><td class="p-3 sm:p-4 text-center text-blue-600 font-bold">${extra > 0 ? extra + 'm' : '--'}</td><td class="p-3 sm:p-4 text-center">${status}</td></tr>`;
                }
            }
            if (tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">Sem registros.</td></tr>';

            const resumoBox = document.getElementById('relatorio-resumo-box');
            if (totalAtraso > 0 || totalExtra > 0) {
                resumoBox.classList.remove('hidden'); resumoBox.classList.add('flex');
                document.getElementById('relatorio-texto-atraso').textContent = formatarTempo(totalAtraso);
                document.getElementById('relatorio-texto-extra').textContent = formatarTempo(totalExtra);
            } else {
                resumoBox.classList.remove('flex'); resumoBox.classList.add('hidden');
            }
        } catch (err) { tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-red-500">Erro.</td></tr>'; }
    };

    window.baixarRelatorioExcel = async function(idFuncionario, nomeFuncionario) {
        const mesAno = document.getElementById('ponto-mes-ano').value;
        if (!mesAno) return alert('Selecione um mês!');
        const [ano, mes] = mesAno.split('-');
        const primeiroDiaStr = `${ano}-${mes}-01`;
        const ultimoDiaNumero = new Date(Number(ano), Number(mes), 0).getDate();
        const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDiaNumero).padStart(2, '0')}`;

        try {
            const { data: funcDados } = await window.bancoDeDados.from('funcionarios').select('horario_entrada, horario_saida, horario_almoco_inicio, horario_almoco_fim').eq('id', idFuncionario).single();
            const { data: registros } = await window.bancoDeDados.from('registros_ponto').select('*').eq('funcionario_id', idFuncionario).gte('data_registro', primeiroDiaStr).lte('data_registro', ultimoDiaStr);

            // Duração do intervalo de almoço (em minutos)
            function minFromHHMM(v, dflt) { const t = v || dflt; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
            const minAlmoco = Math.max(0, minFromHHMM(funcDados.horario_almoco_fim, '14:00') - minFromHHMM(funcDados.horario_almoco_inicio, '13:00'));

            let csv = '\uFEFF'; 
            csv += `RELATÓRIO DE PONTO;${nomeFuncionario}\nMês Referência;${mesAno}\n`;
            csv += `Horário de Trabalho;${funcDados.horario_entrada || '08:00'} às ${funcDados.horario_saida || '17:00'}\n`;
            csv += `Almoço;${funcDados.horario_almoco_inicio || '13:00'} às ${funcDados.horario_almoco_fim || '14:00'} (${minAlmoco}min)\n\n`;
            csv += `Data;Entrada;Saída;Atraso;Hora Extra;Trabalhado;Status\n`;

            let totalAtraso = 0, totalExtra = 0, totalTrabalhado = 0;

            for (let d = 1; d <= ultimoDiaNumero; d++) {
                const dataISO = `${ano}-${mes}-${String(d).padStart(2, '0')}`;
                const dataBR = `${String(d).padStart(2, '0')}/${mes}/${ano}`;
                const reg = (registros || []).find(r => r.data_registro === dataISO);

                let inT = '--:--', outT = '--:--', atrs = 0, extr = 0, trab = 0, st = 'Falta';

                if (reg) {
                    // Conversão das horas para o fuso de Portugal (ignora o fuso do dispositivo).
                    const inPT = window.converterTimestampPortugal(reg.clock_in);
                    const outPT = window.converterTimestampPortugal(reg.clock_out);
                    if (inPT) {
                        inT = inPT.horaFormatada;
                        const [hE, mE] = (funcDados.horario_entrada || '08:00').split(':').map(Number);
                        const diff = inPT.minutosDoDia - (hE * 60 + mE);
                        // Atraso só conta acima de 20 min de tolerância.
                        if (diff > 20) atrs = diff;
                    }
                    if (outPT) {
                        outT = outPT.horaFormatada;
                        const [hS, mS] = (funcDados.horario_saida || '17:00').split(':').map(Number);
                        const diff = outPT.minutosDoDia - (hS * 60 + mS);
                        // Hora extra só conta acima de 20 min de tolerância.
                        if (diff > 20) extr = diff;
                        if (inPT) {
                            // Tempo trabalhado descontando o almoço (em minutos, independente de fuso).
                            const totalMin = (new Date(reg.clock_out) - new Date(reg.clock_in)) / 60000;
                            trab = Math.max(0, totalMin - minAlmoco);
                        }
                    }
                    st = (reg.clock_in && reg.clock_out) ? 'Completo' : 'Trabalhando';
                    totalAtraso += atrs; totalExtra += extr; totalTrabalhado += trab;
                }
                // "=" previne erros de data no Excel
                csv += `="${dataBR}";${inT};${outT};${formatarHoraMinSeg(atrs)};${formatarHoraMinSeg(extr)};${formatarHoraMinSeg(trab)};${st}\n`;
            }

            csv += `\nRESUMO\n`;
            csv += `Total Atrasos:;${formatarHoraMinSeg(totalAtraso)}\n`;
            csv += `Total Horas Extras:;${formatarHoraMinSeg(totalExtra)}\n`;
            csv += `Total Trabalhado:;${formatarHoraMinSeg(totalTrabalhado)}\n`;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Relatorio_${nomeFuncionario.replace(' ','_')}_${mesAno}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) { alert('Erro ao gerar Excel.'); }
    };
    // -------------------------------------------------------------------------
    // Relatório CONSOLIDADO: baixa TODOS os funcionários num único ficheiro
    // Excel (.xlsx), com uma aba por funcionário + uma aba de Resumo Geral.
    // Usa a biblioteca SheetJS (XLSX), carregada via CDN no admin.html.
    // -------------------------------------------------------------------------
    window.baixarRelatorioTodosExcel = async function() {
        const mesAno = document.getElementById('ponto-mes-ano').value;
        if (!mesAno) return alert('Selecione um mês!');
        if (typeof XLSX === 'undefined') return alert('Biblioteca Excel não carregou. Recarregue a página e tente novamente.');

        const [ano, mes] = mesAno.split('-');
        const primeiroDiaStr = `${ano}-${mes}-01`;
        const ultimoDiaNumero = new Date(Number(ano), Number(mes), 0).getDate();
        const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDiaNumero).padStart(2, '0')}`;

        const btn = document.querySelector('[onclick*="baixarRelatorioTodosExcel"]');
        const txtOriginal = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<span>⏳</span> Gerando...'; }

        try {
            const { data: funcionarios } = await window.bancoDeDados.from('funcionarios').select('id, nome_completo, horario_entrada, horario_saida, horario_almoco_inicio, horario_almoco_fim').order('nome_completo');
            const { data: registros } = await window.bancoDeDados.from('registros_ponto').select('*').gte('data_registro', primeiroDiaStr).lte('data_registro', ultimoDiaStr);
            if (!funcionarios || funcionarios.length === 0) { alert('Nenhum funcionário encontrado.'); return; }

            const wb = XLSX.utils.book_new();
            const resumoGeral = [['Funcionário', 'Horário', 'Atrasos', 'Horas Extras', 'Trabalhado']];
            function minFromHHMM(v, dflt) { const t = v || dflt; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
            // Acumuladores para o TOTAL GERAL do mês (soma de todos os funcionários).
            let geralAtraso = 0, geralExtra = 0, geralTrabalhado = 0;

            funcionarios.forEach(func => {
                const minAlmoco = Math.max(0, minFromHHMM(func.horario_almoco_fim, '14:00') - minFromHHMM(func.horario_almoco_inicio, '13:00'));
                const horarioStr = `${func.horario_entrada || '08:00'}-${func.horario_saida || '17:00'}`;
                const dados = [
                    [`RELATÓRIO DE PONTO - ${func.nome_completo}`],
                    [`Mês Referência: ${mesAno}`],
                    [`Horário de Trabalho: ${func.horario_entrada || '08:00'} às ${func.horario_saida || '17:00'}`],
                    [`Almoço: ${func.horario_almoco_inicio || '13:00'} às ${func.horario_almoco_fim || '14:00'} (${minAlmoco}min)`],
                    [],
                    ['Data', 'Entrada', 'Saída', 'Atraso', 'Hora Extra', 'Trabalhado', 'Status']
                ];
                let totalAtraso = 0, totalExtra = 0, totalTrabalhado = 0;
                for (let d = 1; d <= ultimoDiaNumero; d++) {
                    const dataISO = `${ano}-${mes}-${String(d).padStart(2, '0')}`;
                    const dataBR = `${String(d).padStart(2, '0')}/${mes}/${ano}`;
                    const reg = (registros || []).find(r => r.funcionario_id === func.id && r.data_registro === dataISO);
                    let inT = '--:--', outT = '--:--', atrs = 0, extr = 0, trab = 0, st = 'Falta';
                    if (reg) {
                        const inPT = window.converterTimestampPortugal(reg.clock_in);
                        const outPT = window.converterTimestampPortugal(reg.clock_out);
                        if (inPT) {
                            inT = inPT.horaFormatada;
                            const [hE, mE] = (func.horario_entrada || '08:00').split(':').map(Number);
                            const diff = inPT.minutosDoDia - (hE * 60 + mE);
                            if (diff > 20) atrs = diff;
                        }
                        if (outPT) {
                            outT = outPT.horaFormatada;
                            const [hS, mS] = (func.horario_saida || '17:00').split(':').map(Number);
                            const diff = outPT.minutosDoDia - (hS * 60 + mS);
                            if (diff > 20) extr = diff;
                            if (inPT) {
                                const totalMin = (new Date(reg.clock_out) - new Date(reg.clock_in)) / 60000;
                                trab = Math.max(0, totalMin - minAlmoco);
                            }
                        }
                        st = (reg.clock_in && reg.clock_out) ? 'Completo' : 'Trabalhando';
                        totalAtraso += atrs; totalExtra += extr; totalTrabalhado += trab;
                    }
                    dados.push([dataBR, inT, outT, formatarHoraMinSeg(atrs), formatarHoraMinSeg(extr), formatarHoraMinSeg(trab), st]);
                }
                dados.push([]);
                dados.push(['RESUMO']);
                dados.push(['Total Atrasos:', formatarHoraMinSeg(totalAtraso)]);
                dados.push(['Total Horas Extras:', formatarHoraMinSeg(totalExtra)]);
                dados.push(['Total Trabalhado:', formatarHoraMinSeg(totalTrabalhado)]);
                // Soma para o TOTAL GERAL do mês (todas as horas somadas).
                geralAtraso += totalAtraso; geralExtra += totalExtra; geralTrabalhado += totalTrabalhado;

                let nomeAba = func.nome_completo.substring(0, 28).replace(/[\\\/\?\*\[\]:]/g, '');
                if (!nomeAba) nomeAba = `Func_${func.id}`;
                let sufixo = ''; let n = 2;
                while (wb.SheetNames.includes(nomeAba + sufixo)) { sufixo = '_' + n; n++; }
                const ws = XLSX.utils.aoa_to_sheet(dados);
                XLSX.utils.book_append_sheet(wb, ws, nomeAba + sufixo);
                resumoGeral.push([func.nome_completo, horarioStr, formatarHoraMinSeg(totalAtraso), formatarHoraMinSeg(totalExtra), formatarHoraMinSeg(totalTrabalhado)]);
            });

            // Totalização do mês inteiro: soma as horas de TODOS os funcionários.
            resumoGeral.push([]);
            resumoGeral.push(['TOTAL GERAL', '', formatarHoraMinSeg(geralAtraso), formatarHoraMinSeg(geralExtra), formatarHoraMinSeg(geralTrabalhado)]);

            const wsResumo = XLSX.utils.aoa_to_sheet(resumoGeral);
            XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');
            wb.SheetNames.splice(wb.SheetNames.indexOf('Resumo Geral'), 1);
            wb.SheetNames.unshift('Resumo Geral');

            XLSX.writeFile(wb, `Relatorio_Todos_${mesAno}.xlsx`);
        } catch (err) {
            console.error(err);
            alert('Erro ao gerar o relatório de todos.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = txtOriginal; }
        }
    };



    mudarAba('dashboard');
});