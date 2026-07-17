// js/supabase.js

const SUPABASE_URL = 'https://odzlssqzxpmgcjflmkjr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q07PxuT103epQg8O_jULgA_r03cwEiR';

// Salva a conexão globalmente
window.bancoDeDados = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function verificarSessao() {
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    if (usuarioLogado) {
        return JSON.parse(usuarioLogado);
    }
    return null;
}

function fazerLogout() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}