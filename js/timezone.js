// js/timezone.js
// ---------------------------------------------------------------------------
// Utilitários de FUSO HORÁRIO FIXO de Portugal Continental (Figueira da Foz)
// Fuso: Europe/Lisbon (WET no inverno / WEST no verão - horário de verão).
// Usar estas funções em vez de new Date().getHours() garante que o ponto seja
// sempre registrado/contabilizado no horário de Portugal, mesmo que o
// dispositivo do utilizador esteja noutro fuso horário.
// ---------------------------------------------------------------------------

const FUSO_PORTUGAL = 'Europe/Lisbon';

// Extrai os componentes de data/hora de um instante, no fuso de Portugal.
function _partesPortugal(date) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO_PORTUGAL,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    const get = (tipo) => {
        const p = partes.find(x => x.type === tipo);
        return p ? p.value : '';
    };

    let hora = get('hour');
    if (hora === '24') hora = '00'; // segurança para ambientes sem hourCycle h23

    return {
        ano: get('year'), mes: get('month'), dia: get('day'),
        hora, minuto: get('minute'), segundo: get('second')
    };
}

// ---------------------------------------------------------------------------
// Retorna a data/hora ATUAL no fuso de Portugal.
//   - dataISO        : 'YYYY-MM-DD' (para o campo data_registro e filtros)
//   - minutosDoDia  : minutos desde a meia-noite (para cálculo de tolerância)
//   - hora/minuto/segundo : componentes formatados (2 dígitos)
//   - horaFormatada : 'HH:MM:SS'
//   - timestampISO  : instante real em UTC (para gravar clock_in / clock_out)
// ---------------------------------------------------------------------------
window.obterHorarioPortugal = function () {
    const agora = new Date();
    const p = _partesPortugal(agora);
    const dataISO = `${p.ano}-${p.mes}-${p.dia}`;
    const minutosDoDia = (parseInt(p.hora, 10) * 60) + parseInt(p.minuto, 10);

    return {
        dataISO,
        minutosDoDia,
        hora: p.hora,
        minuto: p.minuto,
        segundo: p.segundo,
        horaFormatada: `${p.hora}:${p.minuto}:${p.segundo}`,
        timestampISO: agora.toISOString()
    };
};

// ---------------------------------------------------------------------------
// Converte um timestamp ISO (gravado no banco) para os componentes no fuso
// de Portugal. Usado para EXIBIR as horas e calcular atraso/extra nos
// relatórios sem depender do fuso do dispositivo de quem vê o relatório.
// ---------------------------------------------------------------------------
window.converterTimestampPortugal = function (timestampISO) {
    if (!timestampISO) return null;
    const p = _partesPortugal(new Date(timestampISO));
    return {
        dataISO: `${p.ano}-${p.mes}-${p.dia}`,
        hora: p.hora,
        minuto: p.minuto,
        segundo: p.segundo,
        horaFormatada: `${p.hora}:${p.minuto}:${p.segundo}`,
        minutosDoDia: (parseInt(p.hora, 10) * 60) + parseInt(p.minuto, 10)
    };
};

// ---------------------------------------------------------------------------
// Compõe um instante UTC a partir de uma data ('YYYY-MM-DD') e hora ('HH:mm')
// interpretadas como horário de Portugal. Usa o offset real do fuso
// Europe/Lisbon (já considerando o horário de verão). Usado quando o admin
// "força" um ponto numa data/hora específica em horário de Portugal.
// ---------------------------------------------------------------------------
window.comporTimestampPortugal = function (dataISO, horaStr) {
    const [h, m] = (horaStr || '00:00').split(':').map(Number);
    // Candidato: trata a hora como se fosse UTC (provisório).
    const candidato = new Date(`${dataISO}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
    // Que horas esse instante representa em Portugal?
    const p = _partesPortugal(candidato);
    const minutosDesejados = (h * 60) + m;
    const minutosObtidos = (parseInt(p.hora, 10) * 60) + parseInt(p.minuto, 10);
    let diffMin = minutosDesejados - minutosObtidos;
    if (diffMin > 720) diffMin -= 1440;
    if (diffMin < -720) diffMin += 1440;
    // Desloca o instante para que, em Portugal, ele marque a hora desejada.
    return new Date(candidato.getTime() + diffMin * 60000).toISOString();
};
