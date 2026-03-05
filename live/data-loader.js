const dataCache = new Map();

const CSV_BASE_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/{STATION}/ogd-smn_{STATION}_t_now.csv';

const COLUMN_INDICES = {
    timestamp: 1,
    temperature: 2,
    humidity: 6,
    pressure: 9,
    windGusts: 14,
    windAvg: 16,
    windDirection: 17
};

function getCSVUrl(stationCode) {
    return CSV_BASE_URL.replace(/{STATION}/g, stationCode.toLowerCase());
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(';');
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        if (values.length < headers.length) continue;
        
        const row = {
            timestamp: values[COLUMN_INDICES.timestamp],
            temperature: parseFloat(values[COLUMN_INDICES.temperature]) || null,
            humidity: parseFloat(values[COLUMN_INDICES.humidity]) || null,
            pressure: parseFloat(values[COLUMN_INDICES.pressure]) || null,
            windGusts: parseFloat(values[COLUMN_INDICES.windGusts]) || null,
            windAvg: parseFloat(values[COLUMN_INDICES.windAvg]) || null,
            windDirection: parseFloat(values[COLUMN_INDICES.windDirection]) || null
        };
        
        rows.push(row);
    }
    
    return rows;
}

function parseTimestamp(timestamp) {
    const [datePart, timePart] = timestamp.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hour, minute] = timePart.split(':');
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
}

function formatLocalTime(timestamp) {
    const date = parseTimestamp(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: undefined });
}

function formatHourlyTimestamp(timestamp) {
    const [datePart, timePart] = timestamp.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour] = timePart.split(':');
    const date = new Date(`${year}-${month}-${day}T${hour}:00:00Z`);
    return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: undefined });
}

function convertToChartData(rows, timeframe = 'Hourly') {
    let dataRows = [...rows];
    
    if (timeframe !== 'Monthly') {
        dataRows = dataRows.slice(-144);
    }
    
    const labels = dataRows.map(r => timeframe === 'Monthly' ? formatHourlyTimestamp(r.timestamp) : formatLocalTime(r.timestamp));
    
    return {
        labels: labels,
        datasets: [
            {
                label: 'Average Wind (kph)',
                data: dataRows.map(r => r.windAvg ? Math.round(r.windAvg * 3.6 * 10) / 10 : null),
                borderColor: '#0087f2',
                backgroundColor: 'rgba(0, 135, 242, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5
            },
            {
                label: 'Max Wind Gusts (kph)',
                data: dataRows.map(r => r.windGusts ? Math.round(r.windGusts * 3.6 * 10) / 10 : null),
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5
            },
            {
                label: 'Wind Direction (°)',
                data: dataRows.map(r => r.windDirection || null),
                borderColor: '#32cd32',
                backgroundColor: 'rgba(50, 205, 50, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                yAxisID: 'y1'
            }
        ]
    };
}

function getCurrentValues(rows) {
    if (!rows || rows.length === 0) return null;
    
    const latest = rows[rows.length - 1];
    return {
        temperature: latest.temperature,
        humidity: latest.humidity,
        pressure: latest.pressure,
        windAvg: latest.windAvg ? Math.round(latest.windAvg * 3.6 * 10) / 10 : null,
        windGusts: latest.windGusts ? Math.round(latest.windGusts * 3.6 * 10) / 10 : null,
        windDirection: latest.windDirection
    };
}

function getHourlyAggregated(rows) {
    const hourlyMap = new Map();
    
    rows.forEach(row => {
        const date = parseTimestamp(row.timestamp);
        const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
        
        if (!hourlyMap.has(hourKey)) {
            hourlyMap.set(hourKey, {
                timestamp: hourKey,
                windAvg: [],
                windGusts: [],
                windDirection: [],
                temperature: [],
                humidity: [],
                pressure: []
            });
        }
        
        const hourData = hourlyMap.get(hourKey);
        if (row.windAvg != null) hourData.windAvg.push(row.windAvg);
        if (row.windGusts != null) hourData.windGusts.push(row.windGusts);
        if (row.windDirection != null) hourData.windDirection.push(row.windDirection);
        if (row.temperature != null) hourData.temperature.push(row.temperature);
        if (row.humidity != null) hourData.humidity.push(row.humidity);
        if (row.pressure != null) hourData.pressure.push(row.pressure);
    });
    
    const aggregated = [];
    hourlyMap.forEach((data, key) => {
        const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        aggregated.push({
            timestamp: key,
            windAvg: avg(data.windAvg),
            windGusts: avg(data.windGusts),
            windDirection: avg(data.windDirection),
            temperature: avg(data.temperature),
            humidity: avg(data.humidity),
            pressure: avg(data.pressure)
        });
    });
    
    return aggregated.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function loadData(stationCode = 'BOU', timeframe = 'Hourly') {
    const cacheKey = `windData_${stationCode}_${timeframe}`;
    
    if (dataCache.has(cacheKey)) {
        const cached = dataCache.get(cacheKey);
        if (!(cached instanceof Promise)) return cached;
    }
    
    const csvUrl = getCSVUrl(stationCode);
    
    const promise = fetch(csvUrl)
        .then(r => r.ok ? r.text() : Promise.reject(`HTTP ${r.status}`))
        .then(text => {
            let rows = parseCSV(text);
            // Keep rows chronological: [Earliest, ..., Latest]
            
            const currentValues = getCurrentValues(rows);
            
            if (timeframe === 'Monthly') {
                rows = getHourlyAggregated(rows);
            }
            
            const chartData = convertToChartData(rows, timeframe);
            const data = { ...chartData, current: currentValues };
            dataCache.set(cacheKey, data);
            return data;
        })
        .catch(error => {
            console.error(`Error loading ${stationCode} data:`, error);
            dataCache.delete(cacheKey);
            return Promise.reject(error);
        });
    
    dataCache.set(cacheKey, promise);
    return promise;
}

let currentChart = null;

function getData() {
    const data = dataCache.get('windData');
    if (data instanceof Promise) throw new Error('Data not loaded');
    return data;
}

function createChart(ctx, chartData) {
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, {
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
                    
                    const fmtAvg = avg != null ? Number(avg).toFixed(1) : '--';
                    const fmtGust = gust != null ? Number(gust).toFixed(1) : '--';
                    const fmtDir = dir != null ? Math.round(dir) : '--';

                    alert(`Graph Data Point:\nTime: ${time}\nAvg Wind: ${fmtAvg} kph\nGusts: ${fmtGust} kph\nDirection: ${fmtDir}°`);
                }
            }
        }
    });
}

function populateTable(tableBody, { labels, datasets }) {
    tableBody.innerHTML = '';
    const [avgData, gustData, directionData] = datasets.map(d => d.data);
    
    // Reverse for table display (most recent at top)
    const reversedLabels = [...labels].reverse();
    const revAvg = [...avgData].reverse();
    const revGust = [...gustData].reverse();
    const revDir = [...directionData].reverse();

    reversedLabels.forEach((label, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        const avg = revAvg[i] != null ? Number(revAvg[i]).toFixed(1) : '--';
        const gust = revGust[i] != null ? Number(revGust[i]).toFixed(1) : '--';
        const dir = revDir[i] != null ? Math.round(revDir[i]) : '--';

        tr.onclick = () => {
            alert(`Table Row Selected:\nTime: ${label}\nAvg Wind: ${avg} kph\nGusts: ${gust} kph\nDirection: ${dir}°`);
        };
        tr.innerHTML = `<td>${label}</td><td>${avg}</td><td>${gust}</td><td>${dir}°</td>`;
        tableBody.appendChild(tr);
    });
}

window.WindDashboard = { loadData, getData, createChart, populateTable };