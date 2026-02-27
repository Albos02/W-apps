const dataCache = new Map();

async function loadData() {
    if (dataCache.has('windData')) return dataCache.get('windData');
    
    const promise = fetch('data.json')
        .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
        .then(data => {
            dataCache.set('windData', data);
            return data;
        });
    
    dataCache.set('windData', promise);
    return promise;
}

function getData() {
    const data = dataCache.get('windData');
    if (data instanceof Promise) throw new Error('Data not loaded');
    return data;
}

function createChart(ctx, chartData) {
    return new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 15 } },
                tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#fff', bodyColor: '#fff', borderColor: '#fff', borderWidth: 1 }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } },
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { callback: v => v + ' kph' } },
                y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, max: 360, grid: { drawOnChartArea: false }, ticks: { callback: v => v + '°' } }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            onClick: (event, activeElements, chart) => {
                if (activeElements.length > 0) {
                    const dataIndex = activeElements[0].index;
                    const time = chart.data.labels[dataIndex];
                    const avg = chart.data.datasets[0].data[dataIndex];
                    const gust = chart.data.datasets[1].data[dataIndex];
                    const dir = chart.data.datasets[2].data[dataIndex];
                    
                    alert(`Graph Data Point:\nTime: ${time}\nAvg Wind: ${avg} kph\nGusts: ${gust} kph\nDirection: ${dir}°`);
                }
            }
        }
    });
}

function populateTable(tableBody, { labels, datasets }) {
    tableBody.innerHTML = '';
    const [avgData, gustData, directionData] = datasets.map(d => d.data);
    const currentDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(',', '').replace(/\//g, '/');
    
    labels.forEach((label, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => {
            alert(`Table Row Selected:\nTime: ${currentDate} ${label}\nAvg Wind: ${avgData[i]} kph\nGusts: ${gustData[i]} kph\nDirection: ${directionData[i]}°`);
        };
        tr.innerHTML = `<td>${currentDate} ${label}</td><td>${gustData[i]}</td><td>${avgData[i]}</td><td>${directionData[i]}°</td>`;
        tableBody.appendChild(tr);
    });
}

window.WindDashboard = { loadData, getData, createChart, populateTable };