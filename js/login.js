// js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const viewHome = document.getElementById('view-home');
    const viewEmployees = document.getElementById('view-employees');
    const viewAdmin = document.getElementById('view-admin');
    const modalPin = document.getElementById('modal-pin');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingOverlayText = document.getElementById('loading-overlay-text');

    const btnGiantClockIn = document.getElementById('btn-giant-clockin');
    const btnShowAdmin = document.getElementById('btn-show-admin');
    const btnBackHome = document.getElementById('btn-back-home');
    const btnBackHomeAdmin = document.getElementById('btn-back-home-admin');
    const btnClosePin = document.getElementById('btn-close-pin');

    let funcionarioSelecionado = null;

    // Relógio ao vivo no topo da tela inicial (horário de Portugal).
    const relogioHomeHora = document.getElementById('relogio-home-hora');
    const relogioHomeData = document.getElementById('relogio-home-data');
    if (relogioHomeHora && relogioHomeData && window.obterHorarioPortugal) {
        const atualizarRelogioHome = () => {
            const agora = window.obterHorarioPortugal();
            const dataObj = new Date(`${agora.dataISO}T12:00:00`);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
            relogioHomeHora.textContent = `${agora.hora}:${agora.minuto}:${agora.segundo}`;
            relogioHomeData.textContent = dataFormatada;
        };
        atualizarRelogioHome();
        setInterval(atualizarRelogioHome, 1000);
    }

    btnGiantClockIn.addEventListener('click', () => {
        alternarTela(viewHome, viewEmployees);
        carregarFuncionarios();
    });

    btnShowAdmin.addEventListener('click', () => {
        alternarTela(viewHome, viewAdmin);
        document.getElementById('erro-admin').classList.add('hidden');
    });

    btnBackHome.addEventListener('click', () => alternarTela(viewEmployees, viewHome));
    btnBackHomeAdmin.addEventListener('click', () => alternarTela(viewAdmin, viewHome));
    btnClosePin.addEventListener('click', fecharModalPin);

    function alternarTela(esconder, mostrar) {
        esconder.classList.add('hidden');
        mostrar.classList.remove('hidden');
    }

    function mostrarOverlayCarregando(texto) {
        loadingOverlayText.textContent = texto || 'Entrando...';
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.classList.add('flex');
    }

    function esconderOverlayCarregando() {
        loadingOverlay.classList.add('hidden');
        loadingOverlay.classList.remove('flex');
    }

    function setBotaoCarregando(btn, carregando) {
        btn.disabled = carregando;
        btn.classList.toggle('btn-loading', carregando);
    }

    function renderSkeletonFuncionarios(grid) {
        let html = '';
        for (let i = 0; i < 10; i++) {
            html += `
                <div class="bg-white p-4 sm:p-6 rounded-xl shadow-sm flex flex-col items-center justify-center">
                    <div class="skeleton w-16 h-16 sm:w-24 sm:h-24 rounded-full mb-2 sm:mb-3"></div>
                    <div class="skeleton h-3 sm:h-4 w-3/4 rounded mb-2"></div>
                    <div class="skeleton h-2 sm:h-3 w-1/2 rounded"></div>
                </div>`;
        }
        grid.innerHTML = html;
    }

    async function carregarFuncionarios() {
        const grid = document.getElementById('employee-grid');
        renderSkeletonFuncionarios(grid);

        try {
            const { data: funcionarios, error } = await window.bancoDeDados
                .from('funcionarios')
                .select('id, nome_completo, foto_url, cargo')
                .eq('status', true)
                .eq('role', 'employee')
                .order('nome_completo', { ascending: true });

            if (error) throw error;

            if (!funcionarios || funcionarios.length === 0) {
                grid.innerHTML = '<p class="text-slate-500 col-span-full text-center py-10 font-bold">Nenhum funcionário ativo encontrado.</p>';
                return;
            }

            grid.innerHTML = '';
            funcionarios.forEach(func => {
                const foto = func.foto_url || 'https://via.placeholder.com/150';
                const cargoFormatado = func.cargo || 'Funcionário';
                const card = document.createElement('div');
                card.className = 'fade-in bg-white p-4 sm:p-6 rounded-xl shadow-sm hover:shadow-xl transition transform hover:-translate-y-2 border-b-4 border-transparent hover:border-orange-500 cursor-pointer text-center flex flex-col items-center justify-center';

                card.innerHTML = `
                    <img src="${foto}" class="w-16 h-16 sm:w-24 sm:h-24 mx-auto rounded-full object-cover border-4 border-slate-100 mb-2 sm:mb-3 shadow-sm">
                    <h3 class="font-bold text-slate-800 text-base sm:text-lg truncate w-full leading-tight">${func.nome_completo.split(' ')[0]}</h3>
                    <p class="text-[10px] sm:text-xs text-slate-500 font-medium truncate w-full mt-1">${cargoFormatado}</p>
                `;
                card.addEventListener('click', () => abrirModalPin(func));
                grid.appendChild(card);
            });
        } catch (error) {
            grid.innerHTML = '<p class="text-red-500 col-span-full text-center py-10 font-bold">Erro ao carregar equipe. Verifique a conexão.</p>';
        }
    }

    function abrirModalPin(funcionario) {
        funcionarioSelecionado = funcionario;
        document.getElementById('pin-foto').src = funcionario.foto_url || 'https://via.placeholder.com/150';
        document.getElementById('pin-nome').textContent = funcionario.nome_completo;
        document.getElementById('pin-cargo').textContent = funcionario.cargo || 'Funcionário';
        document.getElementById('input-pin').value = '';
        document.getElementById('erro-pin').classList.add('hidden');

        modalPin.classList.remove('hidden');
        modalPin.classList.add('flex');
        setTimeout(() => document.getElementById('input-pin').focus(), 100);
    }

    function fecharModalPin() {
        modalPin.classList.add('hidden');
        modalPin.classList.remove('flex');
        funcionarioSelecionado = null;
    }

    document.getElementById('form-pin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnConfirmar = document.getElementById('btn-confirmar-pin');
        const pinDigitado = document.getElementById('input-pin').value;
        const erroMsg = document.getElementById('erro-pin');
        erroMsg.classList.add('hidden');
        setBotaoCarregando(btnConfirmar, true);

        try {
            const { data, error } = await window.bancoDeDados.from('funcionarios').select('*').eq('id', funcionarioSelecionado.id).single();
            if (error || data.pin_hash !== pinDigitado) {
                erroMsg.textContent = 'PIN Incorreto!';
                erroMsg.classList.remove('hidden');
                document.getElementById('input-pin').value = '';
                setBotaoCarregando(btnConfirmar, false);
                return;
            }
            salvarSessao(data);
            mostrarOverlayCarregando(`Bem-vindo, ${data.nome_completo.split(' ')[0]}...`);
            setTimeout(() => { window.location.href = 'funcionario.html'; }, 500);
        } catch (error) {
            erroMsg.textContent = 'Erro de conexão.';
            erroMsg.classList.remove('hidden');
            setBotaoCarregando(btnConfirmar, false);
        }
    });

    document.getElementById('form-admin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnConfirmar = document.getElementById('btn-confirmar-admin');
        const matricula = document.getElementById('admin-matricula').value.trim().toLowerCase();
        const pin = document.getElementById('admin-pin').value.trim();
        const erroMsg = document.getElementById('erro-admin');
        erroMsg.classList.add('hidden');
        setBotaoCarregando(btnConfirmar, true);

        try {
            const { data, error } = await window.bancoDeDados.from('funcionarios').select('*').eq('matricula', matricula);
            if (error || !data || data.length === 0) {
                erroMsg.textContent = '❌ Credenciais inválidas!';
                erroMsg.classList.remove('hidden');
                setBotaoCarregando(btnConfirmar, false);
                return;
            }
            const usuario = data[0];
            if (usuario.role !== 'admin') {
                erroMsg.textContent = '⛔ Acesso negado.';
                erroMsg.classList.remove('hidden');
                setBotaoCarregando(btnConfirmar, false);
                return;
            }
            if (usuario.pin_hash !== pin) {
                erroMsg.textContent = '🔑 Senha incorreta!';
                erroMsg.classList.remove('hidden');
                setBotaoCarregando(btnConfirmar, false);
                return;
            }
            salvarSessao(usuario);
            mostrarOverlayCarregando('Acesso concedido. Entrando...');
            setTimeout(() => { window.location.href = 'admin.html'; }, 600);
        } catch (error) {
            erroMsg.textContent = 'Erro no código.';
            erroMsg.classList.remove('hidden');
            setBotaoCarregando(btnConfirmar, false);
        }
    });

    function salvarSessao(usuario) {
        sessionStorage.setItem('usuarioLogado', JSON.stringify({
            id: usuario.id, nome: usuario.nome_completo, cargo: usuario.cargo, foto: usuario.foto_url, role: usuario.role
        }));
    }
});
