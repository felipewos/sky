// Espera o carregamento completo do DOM antes de executar o código
document.addEventListener('DOMContentLoaded', () => {

    // Configurações dos astros (nome, arquivo CSV, cor da barra)
    const BODIES_CONFIG = [
        { name: 'Lua', file: 'lua.csv', color: '#ffffff' },
        { name: 'Mercúrio', file: 'mercurio.csv', color: '#a9a9a9' },
        { name: 'Vênus', file: 'venus.csv', color: '#f5deb3' },
        { name: 'Marte', file: 'marte.csv', color: '#ff7f50' },
        { name: 'Júpiter', file: 'jupiter.csv', color: '#d2b48c' },
        { name: 'Saturno', file: 'saturno.csv', color: '#f0e68c' },
        { name: 'Urano', file: 'urano.csv', color: '#add8e6' },
        { name: 'Netuno', file: 'netuno.csv', color: '#6495ed' }
    ];

    const SUN_FILE = 'sol.csv';      // Nome do arquivo CSV com dados do Sol
    const DATA_PATH = './data/';     // Caminho onde estão os arquivos CSV
    const astroData = {};            // Objeto para armazenar os dados carregados

    let currentDate;                 // Variável global com a data atualmente selecionada

    // Referências aos elementos do DOM
    const dayInput = document.getElementById('day-input');
    const monthInput = document.getElementById('month-input');
    const yearInput = document.getElementById('year-input');
    const prevDayBtn = document.getElementById('prev-day');
    const nextDayBtn = document.getElementById('next-day');
    const todayBtn = document.getElementById('today-btn');
    const chart = document.getElementById('chart');
    const sunsetEl = document.getElementById('sunset');
    const sunriseEl = document.getElementById('sunrise');

    // Função assíncrona que busca e interpreta o conteúdo de um arquivo CSV
    async function fetchAndParseCSV(filePath) {
        try {
            const response = await fetch(filePath); // Requisição do arquivo
            if (!response.ok) throw new Error(`Não foi possível carregar ${filePath}`);
            const text = await response.text();     // Lê conteúdo como texto
            const lines = text.trim().split('\n');  // Divide em linhas
            lines.shift();                            // Remove o cabeçalho
            const data = {};
            lines.forEach(line => {
                const values = line.split(', ');     // Divide linha em colunas
                if (values.length < 4) return;
                const dateStr = values[1].split(' ')[0]; // Extrai apenas a data (sem hora)
                data[dateStr] = { rise: values[1], set: values[3] }; // Armazena os horários
            });
            return data;
        } catch (error) {
            console.error(error); // Mostra erro no console se falhar
            return null;
        }
    }

    // Carrega os dados de todos os planetas e do Sol
    async function loadAllData() {
        const promises = BODIES_CONFIG.map(body =>
            fetchAndParseCSV(DATA_PATH + body.file).then(data => ({ name: body.name, data }))
        );
        promises.push(fetchAndParseCSV(DATA_PATH + SUN_FILE).then(data => ({ name: 'Sol', data })));
        const results = await Promise.all(promises);
        results.forEach(result => {
            if (result && result.data) astroData[result.name] = result.data;
        });
        initializeDate(); // Inicia com a data atual após carregar os dados
    }

    // Converte um horário Date em um número de horas entre 0 e 15 no gráfico
    function timeToHoursInTimeline(date) {
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const fractionalHour = hour + minutes / 60;
        return fractionalHour >= 17 ? fractionalHour - 17 : fractionalHour + 7;
    }

    // Calcula a posição e largura da barra de visibilidade no gráfico
    function calculateBarPosition(riseStr, setStr, selectedDate) {
        const riseTime = new Date(riseStr.replace(' ', 'T'));
        let setTime = new Date(setStr.replace(' ', 'T'));

        // Corrige caso o astro se ponha no dia seguinte
        if (setTime <= riseTime) {
            setTime.setDate(setTime.getDate() + 1);
        }

        // Define os limites do gráfico (das 17h até 7h do dia seguinte)
        const timelineStart = new Date(selectedDate);
        timelineStart.setHours(17, 0, 0, 0);

        const timelineEnd = new Date(selectedDate);
        timelineEnd.setDate(timelineEnd.getDate() + 1);
        timelineEnd.setHours(7, 0, 0, 0);

        // Calcula o intervalo de tempo visível dentro da janela do gráfico
        const visibleStart = new Date(Math.max(riseTime, timelineStart));
        const visibleEnd = new Date(Math.min(setTime, timelineEnd));

        if (visibleEnd <= visibleStart) return { show: false };

        const startHours = timeToHoursInTimeline(visibleStart);
        const endHours = timeToHoursInTimeline(visibleEnd);
        const totalDuration = 15; // Total de horas no gráfico (17h → 7h)

        const width = ((endHours - startHours) / totalDuration) * 100;
        const left = (startHours / totalDuration) * 100;

        return {
            left: Math.max(0, left),
            width: Math.min(100 - left, width),
            show: width > 0
        };
    }

    // Define a data inicial como o dia atual ao meio-dia
    function initializeDate() {
        currentDate = new Date();
        currentDate.setHours(12, 0, 0, 0);
        updateUI();
    }

    // Atualiza os inputs de data e redesenha o gráfico
    function updateUI() {
        dayInput.value = currentDate.getDate();
        monthInput.value = currentDate.getMonth() + 1;
        yearInput.value = currentDate.getFullYear();
        renderChart();
    }

    // Adiciona as linhas verticais de hora dentro de cada linha de planeta
    function addHourLines(barContainer) {
        const totalHours = 15;
        for (let i = 0; i <= totalHours; i++) {
            const line = document.createElement('div');
            line.className = 'hour-line';
            line.style.left = `calc(${(i / totalHours) * 100}% - 0.5px)`;
            barContainer.appendChild(line);
        }
    }

    // ===================================================================
    // FUNÇÃO RENDERCHART AJUSTADA
    // ===================================================================
    function renderChart() {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const selectedDateStr = `${year}-${month}-${day}`;
        chart.innerHTML = ''; // Limpa o gráfico atual

        // AJUSTE: Calcula a string de data para o dia seguinte para buscar eventos da madrugada
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 1);
        const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

        // Atualiza os horários do Sol
        const sunDataForDay = astroData['Sol']?.[selectedDateStr];
        if (sunDataForDay) {
            sunriseEl.textContent = `Nascer do Sol: ${new Date(sunDataForDay.rise.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            sunsetEl.textContent = `Pôr do Sol: ${new Date(sunDataForDay.set.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            sunriseEl.textContent = 'Nascer do Sol: --:--';
            sunsetEl.textContent = 'Pôr do Sol: --:--';
        }

        // Para cada astro, cria a linha no gráfico
        BODIES_CONFIG.forEach(body => {
            const row = document.createElement('div');
            row.className = 'planet-row';

            const nameEl = document.createElement('div');
            nameEl.className = 'planet-name';
            nameEl.textContent = body.name;

            const barContainer = document.createElement('div');
            barContainer.className = 'bar-container';
            addHourLines(barContainer);

            // AJUSTE: Cria um array com os dados do dia principal e da madrugada seguinte.
            // O uso de '?' (Optional Chaining) evita erros se 'astroData[body.name]' não existir.
            const potentialEvents = [
                astroData[body.name]?.[selectedDateStr],
                astroData[body.name]?.[nextDateStr]
            ];
            
            // Percorre os eventos potenciais (eventos do dia e da madrugada)
            potentialEvents.forEach(eventData => {
                // Se o evento existir, tenta desenhar a barra
                if (eventData) {
                    const { left, width, show } = calculateBarPosition(eventData.rise, eventData.set, currentDate);

                    // A condição 'show' garante que a barra só será desenhada
                    // se for visível dentro da janela do gráfico (17h - 07h).
                    if (show) {
                        const bar = document.createElement('div');
                        bar.className = 'visibility-bar';
                        bar.style.backgroundColor = body.color;
                        bar.style.left = `${left}%`;
                        bar.style.width = `${width}%`;

                        // Adiciona os horários se a barra for larga o suficiente
                        if (width > 0) {
                            const riseTimeEl = document.createElement('span');
                            riseTimeEl.textContent = new Date(eventData.rise.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            const setTimeEl = document.createElement('span');
                            setTimeEl.textContent = new Date(eventData.set.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            bar.appendChild(riseTimeEl);
                            bar.appendChild(setTimeEl);
                        }
                        barContainer.appendChild(bar);
                    }
                }
            });

            // Adiciona os elementos na linha e a linha no gráfico
            row.appendChild(nameEl);
            row.appendChild(barContainer);
            chart.appendChild(row);
        });
    }

    // Evento: botão de dia anterior
    prevDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        updateUI();
    });

    // Evento: botão de dia seguinte
    nextDayBtn.addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 1);
        updateUI();
    });

    // Evento: botão "Hoje"
    todayBtn.addEventListener('click', () => {
        currentDate = new Date();
        currentDate.setHours(12, 0, 0, 0);
        updateUI();
    });

    // Evento: mudança manual de data pelos inputs
    [dayInput, monthInput, yearInput].forEach(input => {
        input.addEventListener('change', () => {
            const day = parseInt(dayInput.value);
            const month = parseInt(monthInput.value) - 1;
            const year = parseInt(yearInput.value);
            const newDate = new Date(year, month, day);
            if (!isNaN(newDate) && newDate.getDate() === day) {
                currentDate = newDate;
                currentDate.setHours(12, 0, 0, 0);
                updateUI();
            } else {
                updateUI(); // Re-renderiza com a data antiga se a nova for inválida
            }
        });
    });

    // Inicia carregamento dos dados após o DOM ser carregado
    loadAllData();

    // Cria os rótulos de hora no topo do gráfico (de 17h a 7h)
    function createHourLabels() {
        const container = document.getElementById('time-labels');
        const totalHours = 15;
        for (let i = 0; i < totalHours; i++) {
            const hour = (17 + i) % 24;
            const label = document.createElement('div');
            label.className = 'hour-label';
            label.style.left = `${(i / totalHours) * 100}%`;
            label.textContent = hour;
            container.appendChild(label);
        }
    }

    createHourLabels(); // Cria os rótulos assim que a página carrega
});