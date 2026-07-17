// js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Verificação de Segurança
    const usuarioString = sessionStorage.getItem('usuarioLogado');
    if (!usuarioString) { window.location.href = 'index.html'; return; }
    const usuarioLogado = JSON.parse(usuarioString);
    if (usuarioLogado.role !== 'admin') { window.location.href = 'index.html'; return; }

    document.getElementById('admin-nome').textContent = usuarioLogado.nome;
    if (usuarioLogado.foto) document.getElementById('admin-foto').src = usuarioLogado.foto;

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

        if (abaAtiva === 'dashboard') {
            document.getElementById('titulo-pagina').textContent = 'Visão Geral do Dia';
            carregarDashboard();
        } else if (abaAtiva === 'funcionarios') {
            document.getElementById('titulo-pagina').textContent = 'Gestão de Funcionários';
            carregarTabelaFuncionarios();
        } else if (abaAtiva === 'ponto') {
            document.getElementById('titulo-pagina').textContent = 'Relatórios de Ponto';
            carregarPastasPonto();
        }
    }
    document.getElementById('nav-dashboard').addEventListener('click', () => mudarAba('dashboard'));
    document.getElementById('nav-funcionarios').addEventListener('click', () => mudarAba('funcionarios'));
    document.getElementById('nav-ponto').addEventListener('click', () => mudarAba('ponto'));


    // 1. Lógica do Dashboard
    async function carregarDashboard() {
        const dataHoje = new Date();
        const strHoje = dataHoje.toLocaleDateString('en-CA'); 
        document.getElementById('titulo-presentes').textContent = `🟢 Já Fizeram Clock In (${dataHoje.toLocaleDateString('pt-BR')})`;

        try {
            const { data: equipe } = await window.bancoDeDados.from('funcionarios').select('*').eq('status', true);
            const { data: pontosHoje } = await window.bancoDeDados.from('registros_ponto').select('*').eq('data_registro', strHoje);

            const presentes = [];
            const pendentes = [];

            (equipe || []).forEach(func => {
                const registroFunc = (pontosHoje || []).find(p => p.funcionario_id === func.id);
                if (registroFunc && registroFunc.clock_in) presentes.push({ ...func, clock_in: registroFunc.clock_in });
                else pendentes.push(func);
            });

            document.getElementById('dash-total').textContent = equipe ? equipe.length : 0;
            document.getElementById('dash-presentes').textContent = presentes.length;
            document.getElementById('dash-pendentes').textContent = pendentes.length;

            const ulPresentes = document.getElementById('lista-presentes');
            ulPresentes.innerHTML = presentes.length === 0 ? '<li class="text-slate-500 text-sm">Ninguém bateu ponto ainda.</li>' : '';
            presentes.forEach(p => {
                ulPresentes.innerHTML += `
                    <li class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg mb-2 shadow-sm">
                        <div class="flex items-center gap-3"><img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-full object-cover"><div><p class="font-bold text-slate-800">${p.nome_completo}</p></div></div>
                        <div class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded">${new Date(p.clock_in).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </li>`;
            });

            const ulPendentes = document.getElementById('lista-pendentes');
            ulPendentes.innerHTML = pendentes.length === 0 ? '<li class="text-slate-500 text-sm">Todos bateram o ponto! 🎉</li>' : '';
            pendentes.forEach(p => {
                ulPendentes.innerHTML += `
                    <li class="flex items-center justify-between p-3 bg-white border-l-4 border-l-red-500 rounded-lg mb-2 shadow-sm">
                        <div class="flex items-center gap-3"><img src="${p.foto_url || 'https://via.placeholder.com/150'}" class="w-8 h-8 rounded-full object-cover"><p class="font-bold text-slate-800 text-sm">${p.nome_completo}</p></div>
                        <button onclick="avisarFuncionario(this)" class="text-xs text-white bg-orange-500 px-3 py-1 rounded font-bold hover:bg-orange-600 transition">Avisar</button>
                    </li>`;
            });
        } catch (error) { console.error(error); }
    }

    window.avisarFuncionario = function(btn) {
        alert('Notificação enviada com sucesso para o funcionário!');
        btn.textContent = '✅ Avisado';
        btn.classList.replace('bg-orange-500', 'bg-emerald-100');
        btn.classList.add('text-emerald-700', 'cursor-default');
        btn.disabled = true;
    };

    // 2. Tabela de Funcionários e Gestão
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

                tbody.innerHTML += `
                    <tr class="border-b border-slate-100 hover:bg-slate-50">
                        <td class="p-4 flex items-center gap-3"><img src="${foto}" class="w-10 h-10 rounded-full object-cover shadow-sm"><div><p class="font-bold text-slate-800">${func.nome_completo}</p></div></td>
                        <td class="p-4 font-mono text-sm text-slate-600">${func.matricula}</td>
                        <td class="p-4 text-center">${badgeRole}</td>
                        <td class="p-4 text-center flex justify-center gap-1">
                            <button onclick="abrirModalForcar('${func.id}', '${func.nome_completo}')" class="text-purple-600 hover:bg-purple-100 p-2 rounded transition" title="Forçar Ponto Manual">⚡</button>
                            <button onclick="abrirModalSenha('${func.id}', '${func.nome_completo}')" class="text-yellow-600 hover:bg-yellow-100 p-2 rounded transition" title="Alterar Senha do Funcionário">🔑</button>
                            <button onclick="abrirModalEdicao('${func.id}')" class="text-slate-500 hover:bg-slate-200 p-2 rounded transition" title="Editar Perfil">✏️</button>
                            ${btnExcluir}
                        </td>
                    </tr>`;
            });
        } catch (err) { tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500">Erro.</td></tr>`; }
    }

    document.getElementById('func-foto-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) { alert('Foto muito grande! O tamanho máximo permitido é 1MB.'); return; }
        const reader = new FileReader();
        reader.onload = (event) => {
            fotoBase64Temporaria = event.target.result;
            document.getElementById('func-foto-preview').src = fotoBase64Temporaria;
        };
        reader.readAsDataURL(file);
    });

    const form = document.getElementById('form-funcionario');
    document.getElementById('btn-novo-funcionario').addEventListener('click', () => {
        form.reset();
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
        document.getElementById('func-role').value = func.role;
        document.getElementById('func-entrada').value = func.horario_entrada || '08:00';
        document.getElementById('func-saida').value = func.horario_saida || '17:00';
        
        fotoBase64Temporaria = func.foto_url || null;
        document.getElementById('func-foto-preview').src = fotoBase64Temporaria || 'https://via.placeholder.com/150';
        
        document.getElementById('modal-titulo').textContent = 'Editar Funcionário';
        document.getElementById('modal-funcionario').classList.replace('hidden', 'flex');
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('func-id').value;
        const dados = {
            nome_completo: document.getElementById('func-nome').value,
            matricula: document.getElementById('func-matricula').value.trim().toLowerCase(),
            pin_hash: document.getElementById('func-pin').value,
            cargo: document.getElementById('func-cargo').value,
            role: document.getElementById('func-role').value,
            horario_entrada: document.getElementById('func-entrada').value,
            horario_saida: document.getElementById('func-saida').value,
            status: true
        };
        if (fotoBase64Temporaria) { dados.foto_url = fotoBase64Temporaria; }
        try {
            if (id) await window.bancoDeDados.from('funcionarios').update(dados).eq('id', id);
            else await window.bancoDeDados.from('funcionarios').insert([dados]);
            alert('Salvo com sucesso!');
            document.getElementById('modal-funcionario').classList.replace('flex', 'hidden');
            carregarTabelaFuncionarios();
            carregarDashboard();
        } catch (err) { alert('Erro: Matrícula já existe ou banco offline.'); }
    });

    window.excluirFuncionario = async function(id) {
        if (!confirm('Excluir este funcionário apagará os dados de ponto dele. Continuar?')) return;
        try {
            await window.bancoDeDados.from('funcionarios').delete().eq('id', id);
            carregarTabelaFuncionarios();
        } catch (err) { alert('Erro ao excluir.'); }
    };

    window.abrirModalSenha = function(id, nome) {
        document.getElementById('senha-id').value = id;
        document.getElementById('senha-nome').textContent = `Usuário: ${nome}`;
        document.getElementById('senha-nova').value = '';
        document.getElementById('modal-mudar-senha').classList.replace('hidden', 'flex');
    };

    window.abrirModalSenhaAdmin = function() {
        const usuarioAtual = JSON.parse(sessionStorage.getItem('usuarioLogado'));
        abrirModalSenha(usuarioAtual.id, usuarioAtual.nome + ' (Sua Conta)');
    };

    document.getElementById('form-mudar-senha').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('senha-id').value;
        const novoPin = document.getElementById('senha-nova').value;
        try {
            await window.bancoDeDados.from('funcionarios').update({ pin_hash: novoPin }).eq('id', id);
            alert('Senha alterada com sucesso!');
            document.getElementById('modal-mudar-senha').classList.replace('flex', 'hidden');
            carregarTabelaFuncionarios();
        } catch (err) { alert('Erro ao alterar a senha: ' + err.message); }
    });

    window.abrirModalForcar = function(id, nome) {
        document.getElementById('forcar-id').value = id;
        document.getElementById('forcar-nome').textContent = nome;
        document.getElementById('forcar-data').value = new Date().toLocaleDateString('en-CA');
        document.getElementById('modal-forcar-ponto').classList.replace('hidden', 'flex');
    };

    document.getElementById('form-forcar-ponto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('forcar-id').value;
        const dataStr = document.getElementById('forcar-data').value;
        const tipo = document.getElementById('forcar-tipo').value;
        const horaStr = document.getElementById('forcar-hora').value;
        const timestamp = new Date(`${dataStr}T${horaStr}:00`).toISOString();

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
        } catch (err) { alert('Erro ao forçar ponto.'); }
    });


    // 4. Pastas de Controle de Ponto Mensal e PDF/Excel
    const inputMesAno = document.getElementById('ponto-mes-ano');
    const hojeData = new Date();
    inputMesAno.value = `${hojeData.getFullYear()}-${String(hojeData.getMonth() + 1).padStart(2, '0')}`;
    inputMesAno.addEventListener('change', carregarPastasPonto);

    async function carregarPastasPonto() {
        const divPastas = document.getElementById('lista-pastas-ponto');
        divPastas.innerHTML = '<p class="text-slate-500">Buscando pastas da equipe...</p>';
        try {
            const { data: funcionarios } = await window.bancoDeDados.from('funcionarios').select('id, nome_completo, foto_url').order('nome_completo');
            divPastas.innerHTML = '';
            
            funcionarios.forEach(func => {
                const foto = func.foto_url || 'https://via.placeholder.com/150';
                
                divPastas.innerHTML += `
                    <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col items-center text-center gap-3 transition hover:shadow-md hover:border-orange-300">
                        <img src="${foto}" class="w-16 h-16 rounded-full object-cover shadow-sm">
                        <div>
                            <h4 class="font-bold text-slate-800">${func.nome_completo}</h4>
                            <p class="text-xs text-slate-500 uppercase tracking-widest mt-1">Pasta Mensal</p>
                        </div>
                        <div class="w-full mt-2 space-y-2">
                            <button onclick="abrirRelatorioTela('${func.id}', '${func.nome_completo}')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition">
                                <span>👁️</span> Ver Relatório
                            </button>
                            <button onclick="baixarRelatorioExcel('${func.id}', '${func.nome_completo}')" class="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition">
                                <span>📊</span> Baixar Excel
                            </button>
                        </div>
                    </div>`;
            });
        } catch (err) { console.error(err); }
    }

    // Função auxiliar para formatar horas (Ex: "1h 30m" ou "45m")
    function formatarTempo(totalMinutos) {
        if (totalMinutos === 0) return '0m';
        const d = Math.floor(totalMinutos / 1440);
        const h = Math.floor((totalMinutos % 1440) / 60);
        const m = totalMinutos % 60;
        let str = '';
        if (d > 0) str += `${d} dias, `;
        if (h > 0) str += `${h}h `;
        str += `${m}m`;
        return str;
    }

    // --- RELATÓRIO NA TELA (COM ATRASO E HORA EXTRA) ---
    window.abrirRelatorioTela = async function(idFuncionario, nomeFuncionario) {
        const mesAno = document.getElementById('ponto-mes-ano').value;
        if (!mesAno) return alert('Selecione um mês primeiro!');

        const [ano, mes] = mesAno.split('-');
        const primeiroDiaStr = `${ano}-${mes}-01`;
        const ultimoDiaNumero = new Date(ano, mes, 0).getDate();
        const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDiaNumero).padStart(2, '0')}`;

        document.getElementById('relatorio-tela-nome').textContent = nomeFuncionario;
        document.getElementById('relatorio-tela-mes').textContent = `Período: ${mesAno}`;
        const tbody = document.getElementById('tabela-relatorio-tela');
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">Buscando registros do servidor...</td></tr>';
        
        document.getElementById('modal-ver-relatorio').classList.replace('hidden', 'flex');

        try {
            // Busca o horário oficial do funcionário
            const { data: funcDados } = await window.bancoDeDados.from('funcionarios').select('horario_entrada, horario_saida').eq('id', idFuncionario).single();
            const horarioOficialEntrada = funcDados && funcDados.horario_entrada ? funcDados.horario_entrada : '08:00';
            const horarioOficialSaida = funcDados && funcDados.horario_saida ? funcDados.horario_saida : '17:00';

            const { data: registros } = await window.bancoDeDados.from('registros_ponto')
                .select('*')
                .eq('funcionario_id', idFuncionario)
                .gte('data_registro', primeiroDiaStr)
                .lte('data_registro', ultimoDiaStr);

            tbody.innerHTML = '';
            
            const hojeLocal = new Date().getDate();
            const mesAtualLocal = new Date().getMonth() + 1;
            const anoAtualLocal = new Date().getFullYear();

            let totalAtrasosMinutos = 0;
            let qtdDiasAtraso = 0;
            let totalExtrasMinutos = 0;
            let qtdDiasExtra = 0;

            for (let d = 1; d <= ultimoDiaNumero; d++) {
                if (parseInt(ano) === anoAtualLocal && parseInt(mes) === mesAtualLocal && d > hojeLocal) continue; 

                const dataISO = `${ano}-${mes}-${String(d).padStart(2, '0')}`;
                const dataBR = `${String(d).padStart(2, '0')}/${mes}/${ano}`;
                const registroDia = (registros || []).find(r => r.data_registro === dataISO);

                let inTime = '--:--';
                let outTime = '--:--';
                let statusHtml = '<span class="bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-xs">❌ FALTA</span>';
                let atrasoFormatado = '--';
                let extraFormatado = '--';

                if (registroDia) {
                    // Verificação de Entrada (Atraso)
                    if (registroDia.clock_in) {
                        const dataIn = new Date(registroDia.clock_in);
                        inTime = dataIn.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        
                        const minRegistradosIn = (dataIn.getHours() * 60) + dataIn.getMinutes();
                        const [hEspIn, mEspIn] = horarioOficialEntrada.split(':').map(Number);
                        const minEsperadosIn = (hEspIn * 60) + mEspIn;

                        if (minRegistradosIn > minEsperadosIn) {
                            const minutosAtraso = minRegistradosIn - minEsperadosIn;
                            totalAtrasosMinutos += minutosAtraso;
                            qtdDiasAtraso++;
                            atrasoFormatado = `${minutosAtraso} min`;
                        }
                    }

                    // Verificação de Saída (Hora Extra)
                    if (registroDia.clock_out) {
                        const dataOut = new Date(registroDia.clock_out);
                        outTime = dataOut.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        const minRegistradosOut = (dataOut.getHours() * 60) + dataOut.getMinutes();
                        const [hEspOut, mEspOut] = horarioOficialSaida.split(':').map(Number);
                        const minEsperadosOut = (hEspOut * 60) + mEspOut;

                        if (minRegistradosOut > minEsperadosOut) {
                            const minutosExtra = minRegistradosOut - minEsperadosOut;
                            totalExtrasMinutos += minutosExtra;
                            qtdDiasExtra++;
                            extraFormatado = `${minutosExtra} min`;
                        }
                    }
                    
                    if (registroDia.clock_in && registroDia.clock_out) {
                        statusHtml = '<span class="bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded text-xs">✅ COMPLETO</span>';
                    } else if (registroDia.clock_in && !registroDia.clock_out) {
                        if (parseInt(ano) === anoAtualLocal && parseInt(mes) === mesAtualLocal && d === hojeLocal) {
                            statusHtml = '<span class="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs">🔄 TRABALHANDO</span>';
                        }
                    }
                }

                tbody.innerHTML += `
                    <tr class="border-b border-slate-100 hover:bg-slate-50">
                        <td class="p-4 font-bold text-slate-700">${dataBR}</td>
                        <td class="p-4 font-mono text-center text-emerald-600 font-bold">${inTime}</td>
                        <td class="p-4 font-mono text-center text-orange-600 font-bold">${outTime}</td>
                        <td class="p-4 font-mono text-center text-red-600 font-bold">${atrasoFormatado}</td>
                        <td class="p-4 font-mono text-center text-blue-600 font-bold">${extraFormatado}</td>
                        <td class="p-4 text-center">${statusHtml}</td>
                    </tr>
                `;
            }

            // Resumo de Atrasos e Horas Extras
            const resumoBox = document.getElementById('relatorio-resumo-box');
            
            if (qtdDiasAtraso > 0 || qtdDiasExtra > 0) {
                resumoBox.classList.remove('hidden');
                resumoBox.classList.add('flex');
                
                document.getElementById('relatorio-texto-atraso').innerHTML = `${qtdDiasAtraso} ocorrências no mês<br><span class="text-xs text-red-700 block mt-1">Total acumulado: ${formatarTempo(totalAtrasosMinutos)}</span>`;
                
                document.getElementById('relatorio-texto-extra').innerHTML = `${qtdDiasExtra} ocorrências no mês<br><span class="text-xs text-blue-700 block mt-1">Total acumulado: ${formatarTempo(totalExtrasMinutos)}</span>`;
            } else {
                resumoBox.classList.remove('flex');
                resumoBox.classList.add('hidden');
            }

            if (tbody.innerHTML === '') {
                tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">Nenhum dia para exibir.</td></tr>';
            }

        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-500">Erro ao carregar dados.</td></tr>';
        }
    };

    // --- BAIXAR EXCEL COM DATA CORRIGIDA E HORA EXTRA ---
    window.baixarRelatorioExcel = async function(idFuncionario, nomeFuncionario) {
        const mesAno = document.getElementById('ponto-mes-ano').value;
        if (!mesAno) return alert('Selecione um mês primeiro!');
        
        const [ano, mes] = mesAno.split('-');
        const primeiroDiaStr = `${ano}-${mes}-01`;
        const ultimoDiaNumero = new Date(ano, mes, 0).getDate();
        const ultimoDiaStr = `${ano}-${mes}-${String(ultimoDiaNumero).padStart(2, '0')}`;

        try {
            const { data: funcDados } = await window.bancoDeDados.from('funcionarios').select('horario_entrada, horario_saida').eq('id', idFuncionario).single();
            const horarioOficialEntrada = funcDados && funcDados.horario_entrada ? funcDados.horario_entrada : '08:00';
            const horarioOficialSaida = funcDados && funcDados.horario_saida ? funcDados.horario_saida : '17:00';

            const { data: registros } = await window.bancoDeDados.from('registros_ponto')
                .select('*')
                .eq('funcionario_id', idFuncionario)
                .gte('data_registro', primeiroDiaStr)
                .lte('data_registro', ultimoDiaStr);

            let csv = '\uFEFF'; 
            csv += `RELATÓRIO DE PONTO;${nomeFuncionario}\n`;
            csv += `Mês de Referência;${mesAno}\n\n`;
            // Colunas
            csv += `Data;Entrada (Clock In);Saída (Clock Out);Atraso (Minutos);Hora Extra (Minutos);Status de Completude\n`;

            const hojeLocal = new Date().getDate();
            const mesAtualLocal = new Date().getMonth() + 1;
            const anoAtualLocal = new Date().getFullYear();

            let totalAtrasosMinutos = 0;
            let qtdDiasAtraso = 0;
            let totalExtrasMinutos = 0;
            let qtdDiasExtra = 0;

            for (let d = 1; d <= ultimoDiaNumero; d++) {
                if (parseInt(ano) === anoAtualLocal && parseInt(mes) === mesAtualLocal && d > hojeLocal) continue;

                const dataISO = `${ano}-${mes}-${String(d).padStart(2, '0')}`;
                
                // Formatação manual da data como texto para forçar o Excel a não bugar
                const dataBR = `${String(d).padStart(2, '0')}/${mes}/${ano}`;
                
                const registroDia = (registros || []).find(r => r.data_registro === dataISO);

                let inTime = '--:--';
                let outTime = '--:--';
                let status = 'INCOMPLETO / FALTA';
                let atrasoPlanilha = '0';
                let extraPlanilha = '0';

                if (registroDia) {
                    if (registroDia.clock_in) {
                        const dataIn = new Date(registroDia.clock_in);
                        inTime = dataIn.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        const minRegistradosIn = (dataIn.getHours() * 60) + dataIn.getMinutes();
                        const [hEspIn, mEspIn] = horarioOficialEntrada.split(':').map(Number);
                        const minEsperadosIn = (hEspIn * 60) + mEspIn;

                        if (minRegistradosIn > minEsperadosIn) {
                            const minutosAtraso = minRegistradosIn - minEsperadosIn;
                            totalAtrasosMinutos += minutosAtraso;
                            qtdDiasAtraso++;
                            atrasoPlanilha = `${minutosAtraso}`;
                        }
                    }

                    if (registroDia.clock_out) {
                        const dataOut = new Date(registroDia.clock_out);
                        outTime = dataOut.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        const minRegistradosOut = (dataOut.getHours() * 60) + dataOut.getMinutes();
                        const [hEspOut, mEspOut] = horarioOficialSaida.split(':').map(Number);
                        const minEsperadosOut = (hEspOut * 60) + mEspOut;

                        if (minRegistradosOut > minEsperadosOut) {
                            const minutosExtra = minRegistradosOut - minEsperadosOut;
                            totalExtrasMinutos += minutosExtra;
                            qtdDiasExtra++;
                            extraPlanilha = `${minutosExtra}`;
                        }
                    }
                    
                    if (registroDia.clock_in && registroDia.clock_out) {
                        status = 'COMPLETO';
                    }
                }

                // O comando ="Texto" obriga o Excel a mostrar a data perfeitamente sem formatar errado
                csv += `="${dataBR}";${inTime};${outTime};${atrasoPlanilha};${extraPlanilha};${status}\n`;
            }

            // CRIAÇÃO DO BLOCO DE RESUMO NO EXCEL
            csv += `\n\nRESUMO DO MÊS\n`;
            csv += `Dias com Atraso:;${qtdDiasAtraso};Total de Minutos de Atraso:;${totalAtrasosMinutos} min;Tempo Acumulado:;${formatarTempo(totalAtrasosMinutos)}\n`;
            csv += `Dias com Hora Extra:;${qtdDiasExtra};Total de Minutos de H. Extra:;${totalExtrasMinutos} min;Tempo Acumulado:;${formatarTempo(totalExtrasMinutos)}\n`;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Relatorio_Ponto_${nomeFuncionario.replace(' ','_')}_${mesAno}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) { alert('Erro ao gerar arquivo.'); }
    };

    mudarAba('dashboard');
});