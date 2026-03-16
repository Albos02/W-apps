const dataCache = new Map();

const CSV_BASE_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/{STATION}/ogd-smn_{STATION}_t_now.csv';
const CSV_RECENT_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/{STATION}/ogd-smn_{STATION}_t_recent.csv';

const COLUMN_INDICES = {
    timestamp: 1,
    temperature: 2,
    humidity: 6,
    pressure: 9,
    pressureQff: 10,
    pressureQnh: 11,
    windGusts: 14,
    windAvg: 16,
    windDirection: 17
};

// Configuration for time periods and aggregation
const TIME_PERIODS = {
    '3 Hours': 3,      // 3 hours
    'Day': 24,         // 24 hours
    'Week': 168,       // 7 days
    'Month': 720       // 30 days
};

const AGGREGATION = {
    '3 Hours': null,
    'Day': null,
    'Week': 'hourly',
    'Month': '6hour'
};

const AGGREGATION_METHODS = {
    windAvg: 'avg',
    windGusts: 'max',
    windDirection: 'avg',
    temperature: 'avg',
    humidity: 'avg',
    pressure: 'avg'
};

const POINTS_PER_HOUR = 6;

const TIMEFRAME_LIMITS = {};
for (const [key, hours] of Object.entries(TIME_PERIODS)) {
    TIMEFRAME_LIMITS[key] = POINTS_PER_HOUR * hours;
}

function getCSVUrl(stationCode) {
    return CSV_BASE_URL.replace(/{STATION}/g, stationCode.toLowerCase());
}

function getRecentCSVUrl(stationCode) {
    return CSV_RECENT_URL.replace(/{STATION}/g, stationCode.toLowerCase());
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
            pressureQff: parseFloat(values[COLUMN_INDICES.pressureQff]) || null,
            pressureQnh: parseFloat(values[COLUMN_INDICES.pressureQnh]) || null,
            windGusts: parseFloat(values[COLUMN_INDICES.windGusts]) || null,
            windAvg: parseFloat(values[COLUMN_INDICES.windAvg]) || null,
            windDirection: parseFloat(values[COLUMN_INDICES.windDirection]) || null
        };
        
        rows.push(row);
    }
    
    return rows;
}

function mergeData(nowRows, recentRows) {
    if (!nowRows || nowRows.length === 0) return recentRows || [];
    if (!recentRows || recentRows.length === 0) return nowRows;
    
    const nowLatest = nowRows[nowRows.length - 1];
    const nowLatestDate = parseTimestamp(nowLatest.timestamp);
    
    const olderRows = recentRows.filter(row => {
        const rowDate = parseTimestamp(row.timestamp);
        return rowDate < nowLatestDate;
    });
    
    return [...olderRows, ...nowRows];
}

function parseTimestamp(timestamp) {
    if (!timestamp) return new Date(0);
    const parts = timestamp.split(' ');
    const datePart = parts[0] || '';
    const timePart = parts[1] || '00:00';
    const [day, month, year] = datePart.split('.');
    const [hour, minute] = timePart.split(':');
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
}

function formatLocalTime(timestamp) {
    const date = parseTimestamp(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: undefined });
}

function formatDayTime(timestamp) {
    const date = parseTimestamp(timestamp);
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: undefined });
    return `${dayName} ${time}`;
}

function formatDate(timestamp) {
    const date = parseTimestamp(timestamp);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function normalizeTimeframe(timeframe) {
    return timeframe.replace(/^Last\s+/, '');
}

function shouldShowDate(labels) {
    if (!labels || labels.length < 2) return false;
    const first = parseTimestamp(labels[0]);
    const last = parseTimestamp(labels[labels.length - 1]);
    const diffHours = (last - first) / (1000 * 60 * 60);
    return diffHours >= 24;
}

function formatLabel(timestamp, timeframe, showDate = null) {
    const date = parseTimestamp(timestamp);
    
    if (showDate === null) {
        showDate = (timeframe === 'Week' || timeframe === 'Month');
    }
    
    if (showDate) {
        const dayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: undefined });
        return `${dayName} ${time}`;
    }
    
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: undefined });
}

function getAggregated(rows, interval) {
    const intervalMinutes = {
        '20min': 20, '30min': 30, 'hourly': 60,
        '2hour': 120, '3hour': 180, '6hour': 360, '12hour': 720, 'daily': 1440
    }[interval];
    
    if (!intervalMinutes) return rows;
    
    const grouped = new Map();
    
    rows.forEach(row => {
        const date = parseTimestamp(row.timestamp);
        const totalMinutes = date.getHours() * 60 + date.getMinutes();
        const bucket = Math.floor(totalMinutes / intervalMinutes);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${bucket}`;
        
        if (!grouped.has(key)) {
            grouped.set(key, {
                timestamp: row.timestamp,
                dateObj: new Date(date),
                bucket: bucket,
                windAvg: [], windGusts: [], windDirection: [],
                temperature: [], humidity: [], pressure: []
            });
        }
        
        const data = grouped.get(key);
        if (row.windAvg != null) data.windAvg.push(row.windAvg);
        if (row.windGusts != null) data.windGusts.push(row.windGusts);
        if (row.windDirection != null) data.windDirection.push(row.windDirection);
        if (row.temperature != null) data.temperature.push(row.temperature);
        if (row.humidity != null) data.humidity.push(row.humidity);
        if (row.pressure != null) data.pressure.push(row.pressure);
    });
    
    const methods = AGGREGATION_METHODS;
    const avgFn = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const maxFn = arr => arr.length ? Math.max(...arr) : null;
    
    const aggregated = [];
    grouped.forEach((data, key) => {
        const date = data.dateObj;
        let timestamp;
        if (interval === 'daily') {
            timestamp = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
        } else {
            const bucketStartMinutes = data.bucket * intervalMinutes;
            const hour = Math.floor(bucketStartMinutes / 60);
            const minute = bucketStartMinutes % 60;
            timestamp = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        }
        
        aggregated.push({
            timestamp: timestamp,
            windAvg: methods.windAvg === 'max' ? maxFn(data.windAvg) : avgFn(data.windAvg),
            windGusts: methods.windGusts === 'max' ? maxFn(data.windGusts) : avgFn(data.windGusts),
            windDirection: methods.windDirection === 'max' ? maxFn(data.windDirection) : avgFn(data.windDirection),
            temperature: methods.temperature === 'max' ? maxFn(data.temperature) : avgFn(data.temperature),
            humidity: methods.humidity === 'max' ? maxFn(data.humidity) : avgFn(data.humidity),
            pressure: methods.pressure === 'max' ? maxFn(data.pressure) : avgFn(data.pressure)
        });
    });
    
    return aggregated.sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
}

function getHourlyAggregated(rows) { return getAggregated(rows, 'hourly'); }
function getDailyAggregated(rows) { return getAggregated(rows, 'daily'); }

function convertToChartData(rows, timeframe = 'Hour') {
    const normalizedTimeframe = normalizeTimeframe(timeframe);
    const limit = TIMEFRAME_LIMITS[normalizedTimeframe] || TIMEFRAME_LIMITS['Hour'];
    let dataRows = rows.slice(-limit);
    
    const aggregation = AGGREGATION[normalizedTimeframe];
    if (aggregation && aggregation !== 'daily') {
        dataRows = getAggregated(dataRows, aggregation);
    } else if (aggregation === 'daily') {
        dataRows = getDailyAggregated(dataRows);
    }
    
    const timestamps = dataRows.map(r => r.timestamp);
    const showDate = shouldShowDate(timestamps);
    const labels = dataRows.map(r => formatLabel(r.timestamp, normalizedTimeframe, showDate));
    
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
        pressureQff: latest.pressureQff,
        pressureQnh: latest.pressureQnh,
        windAvg: latest.windAvg ? Math.round(latest.windAvg * 3.6 * 10) / 10 : null,
        windGusts: latest.windGusts ? Math.round(latest.windGusts * 3.6 * 10) / 10 : null,
        windDirection: latest.windDirection
    };
}

async function loadData(stationCode = 'BOU', timeframe = 'Hourly') {
    const rawCacheKey = `windDataRaw_${stationCode}`;
    let rawRows = dataCache.get(rawCacheKey);
    
    if (!rawRows) {
        try {
            const [nowResponse, recentResponse] = await Promise.all([
                fetch(getCSVUrl(stationCode)),
                fetch(getRecentCSVUrl(stationCode))
            ]);
            
            const nowText = nowResponse.ok ? await nowResponse.text() : '';
            const recentText = recentResponse.ok ? await recentResponse.text() : '';
            
            const nowRows = nowText ? parseCSV(nowText) : [];
            const recentRows = recentText ? parseCSV(recentText) : [];
            
            rawRows = mergeData(nowRows, recentRows);
            dataCache.set(rawCacheKey, rawRows);
        } catch (error) {
            console.error(`Error loading ${stationCode} data:`, error);
            throw error;
        }
    } else if (rawRows instanceof Promise) {
        rawRows = await rawRows;
    }
    
    const currentValues = getCurrentValues(rawRows);
    const chartData = convertToChartData(rawRows, timeframe);
    return { ...chartData, current: currentValues };
}

let currentChart = null;

function getData() {
    const data = dataCache.get('windData');
    if (data instanceof Promise) throw new Error('Data not loaded');
    return data;
}

function createChart(ctx, chartData) {
    if (currentChart) currentChart.destroy();
    
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

function populateTable(tableBody, data) {
    tableBody.innerHTML = '';
    if (!data || !data.datasets || data.datasets.length === 0) return;
    
    const { labels, datasets } = data;
    const [avgData, gustData, directionData] = datasets.map(d => d.data || []);
    
    const reversedLabels = [...labels].reverse();
    const revAvg = [...(avgData || [])].reverse();
    const revGust = [...(gustData || [])].reverse();
    const revDir = [...(directionData || [])].reverse();

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

function createEmptyChart(ctx) {
    createChart(ctx, {
        labels: ['--'],
        datasets: [
            { label: 'Average Wind (kph)', data: [0], borderColor: '#0087f2', backgroundColor: 'rgba(0, 135, 242, 0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 5 },
            { label: 'Max Wind Gusts (kph)', data: [0], borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 5 },
            { label: 'Wind Direction (°)', data: [0], borderColor: '#32cd32', backgroundColor: 'rgba(50, 205, 50, 0.1)', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 3, pointHoverRadius: 5, yAxisID: 'y1' }
        ]
    });
}

window.WindDashboard = { loadData, getData, createChart, populateTable, createEmptyChart };
