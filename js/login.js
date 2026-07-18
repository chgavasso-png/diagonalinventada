// js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const viewHome = document.getElementById('view-home');
    const viewEmployees = document.getElementById('view-employees');
    const viewAdmin = document.getElementById('view-admin');
    const modalPin = document.getElementById('modal-pin');

    const btnGiantClockIn = document.getElementById('btn-giant-clockin');
    const btnShowAdmin = document.getElementById('btn-show-admin');
    const btnBackHome = document.getElementById('btn-back-home');
    const btnBackHomeAdmin = document.getElementById('btn-back-home-admin');
    const btnClosePin = document.getElementById('btn-close-pin');

    let funcionarioSelecionado = null;

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

    async function carregarFuncionarios() {
        const grid = document.getElementById('employee-grid');
        grid.innerHTML = '<p class="text-slate-500 col-span-full text-center py-10 font-bold">Carregando equipe...</p>';

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
                card.className = 'bg-white p-4 sm:p-6 rounded-xl shadow-sm hover:shadow-xl transition transform hover:-translate-y-2 border-b-4 border-transparent hover:border-orange-500 cursor-pointer text-center flex flex-col items-center justify-center';
                
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
        const pinDigitado = document.getElementById('input-pin').value;
        const erroMsg = document.getElementById('erro-pin');
        erroMsg.classList.add('hidden');

        try {
            const { data, error } = await window.bancoDeDados.from('funcionarios').select('*').eq('id', funcionarioSelecionado.id).single();
            if (error || data.pin_hash !== pinDigitado) {
                erroMsg.textContent = 'PIN Incorreto!';
                erroMsg.classList.remove('hidden');
                document.getElementById('input-pin').value = ''; 
                return;
            }
            salvarSessao(data);
            window.location.href = 'funcionario.html';
        } catch (error) {
            erroMsg.textContent = 'Erro de conexão.';
            erroMsg.classList.remove('hidden');
        }
    });

    document.getElementById('form-admin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const matricula = document.getElementById('admin-matricula').value.trim().toLowerCase();
        const pin = document.getElementById('admin-pin').value.trim();
        const erroMsg = document.getElementById('erro-admin');
        erroMsg.classList.add('hidden');

        try {
            const { data, error } = await window.bancoDeDados.from('funcionarios').select('*').eq('matricula', matricula);
            if (error || !data || data.length === 0) {
                erroMsg.textContent = '❌ Credenciais inválidas!';
                erroMsg.classList.remove('hidden');
                return;
            }
            const usuario = data[0]; 
            if (usuario.role !== 'admin') {
                erroMsg.textContent = '⛔ Acesso negado.';
                erroMsg.classList.remove('hidden');
                return;
            }
            if (usuario.pin_hash !== pin) {
                erroMsg.textContent = '🔑 Senha incorreta!';
                erroMsg.classList.remove('hidden');
                return;
            }
            erroMsg.textContent = '✅ SUCESSO! Entrando...';
            erroMsg.classList.remove('hidden', 'text-red-600', 'bg-red-50');
            erroMsg.classList.add('text-green-700', 'bg-green-50', 'p-2', 'rounded', 'font-bold');
            salvarSessao(usuario);
            setTimeout(() => { window.location.href = 'admin.html'; }, 1000);
        } catch (error) { erroMsg.textContent = 'Erro no código.'; erroMsg.classList.remove('hidden'); }
    });

    function salvarSessao(usuario) {
        sessionStorage.setItem('usuarioLogado', JSON.stringify({
            id: usuario.id, nome: usuario.nome_completo, cargo: usuario.cargo, foto: usuario.foto_url, role: usuario.role
        }));
    }
});