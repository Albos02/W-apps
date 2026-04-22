const verticalLinePlugin = {
    id: 'verticalLine',
    afterDraw: (chart) => {
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        const x = chart._verticalLineX;
        if (x == null) return;
        const xPos = xAxis.getPixelForValue(x);
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(xPos, yAxis.top);
        ctx.lineTo(xPos, yAxis.bottom);
        ctx.stroke();
        ctx.restore();
    }
};
Chart.register(verticalLinePlugin);

const dataCache = new Map();

const CSV_BASE_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/{STATION}/ogd-smn_{STATION}_t_now.csv';
const CSV_RECENT_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/{STATION}/ogd-smn_{STATION}_t_recent.csv';

const COLUMN_INDICES = {
    timestamp: 1,
    temperature: 2,
    humidity: 6,
    dewPoint: 7,
    pressure: 9,
    pressureQff: 10,
    pressureQnh: 11,
    windGusts: 14,
    windAvg: 16,
    windDirection: 17,
    precipitation: 23,
    globalRadiation: 25,
    sunshine: 30
};

const METRIC_CONFIG = {
    temperature: { label: 'Temperature', unit: '°C', color: '#E24B4A', agg: 'avg' },
    apparentTemp: { label: 'Apparent Temparature', unit: '°C', color: '#F09595', agg: 'avg'}, // Maybe for later
    dewPoint: { label: 'Dew Point', unit: '°C', color: '#639922', agg: 'avg' },
    humidity: { label: 'Humidity', unit: '%', color: '#0097A7', agg: 'avg' },
    pressure: { label: 'Air Pressure QFE', unit: 'hPa', color: '#33cca6', agg: 'avg', yAxisID: 'y1', decimals: 0 },
    pressureQff: { label: 'Air Pressure QFF', unit: 'hPa', color: '#00bfff', agg: 'avg', decimals: 0 },
    pressureQnh: { label: 'Air Pressure QNH', unit: 'hPa', color: '#19e6e6', agg: 'avg', decimals: 0 },
    windAvg: { label: 'Average Wind', unit: 'kph', color: '#c74f05', agg: 'avg', transform: v => Math.round(v * 3.6 * 10) / 10 },
    windGusts: { label: 'Max Wind Gusts', unit: 'kph', color: '#ff742e', agg: 'max', transform: v => Math.round(v * 3.6 * 10) / 10 },
    windDirection: { label: 'Wind Direction', unit: '°', color: '#a5a49f', agg: 'avg', yAxisID: 'y1', decimals: 0 },
    precipitation: { label: 'Precipitation', unit: 'mm', color: '#0f4a85', agg: 'sum' },
    globalRadiation: { label: 'Global Radiation', unit: 'W/m²', color: '#c38022', agg: 'avg', decimals: 0 },
    sunshine: { label: 'Sunshine Duration', unit: 'min', color: '#ffd51a', agg: 'sum', decimals: 0 },
};

const GROUPS = {
    wind: ['windAvg', 'windGusts', 'windDirection'],
    pressure: ['pressure', 'pressureQff', 'pressureQnh'],
    temperature: ['temperature'],
    dewpoint: ['dewPoint'],
    humidity: ['humidity'],
    precipitation: ['precipitation'],
    sunshine: ['sunshine'],
    radiation: ['globalRadiation']
};

const METRIC_TO_GROUP = {
    windAvg: 'wind',
    windGusts: 'wind',
    windDirection: 'wind',
    temperature: 'temperature',
    dewPoint: 'dewpoint',
    humidity: 'humidity',
    pressure: 'pressure',
    pressureQff: 'pressure',
    pressureQnh: 'pressure',
    precipitation: 'precipitation',
    sunshine: 'sunshine',
    globalRadiation: 'radiation'
};

const TIME_PERIODS = {
    '3 Hours': 3,
    'Day': 24,
    'Week': 168,
    'Month': 720,
    'Year': 8760
};

const AGGREGATION = {
    '3 Hours': null,
    'Day': null,
    'Week': 'hourly',
    'Month': '6hour',
    'Year': 'daily'
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
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        if (values.length < Object.keys(COLUMN_INDICES).length) continue;

        const row = { timestamp: values[COLUMN_INDICES.timestamp] };

        for (const param of Object.keys(METRIC_CONFIG)) {
            const idx = COLUMN_INDICES[param];
            const raw = parseFloat(values[idx]);
            row[param] = isNaN(raw) ? null : raw;
        }

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
        const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const hour = date.getHours();
        return `${dayName}\u00A0${hour}h ${day}/${month}`;
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
            const initialData = {
                timestamp: row.timestamp,
                dateObj: new Date(date),
                bucket: bucket
            };
            for (const param of Object.keys(METRIC_CONFIG)) {
                initialData[param] = [];
            }
            grouped.set(key, initialData);
        }

        const data = grouped.get(key);
        for (const param of Object.keys(METRIC_CONFIG)) {
            if (row[param] != null) {
                data[param].push(row[param]);
            }
        }
    });

    const avgFn = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const maxFn = arr => arr.length ? Math.max(...arr) : null;
    const sumFn = arr => arr.length ? arr.reduce((a, b) => a + b, 0) : null;

    const aggregated = [];
    grouped.forEach((data) => {
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

        const row = { timestamp: timestamp };
        for (const [param, config] of Object.entries(METRIC_CONFIG)) {
            if (config.agg === 'max') {
                row[param] = maxFn(data[param]);
            } else if (config.agg === 'sum') {
                row[param] = sumFn(data[param]);
            } else {
                row[param] = avgFn(data[param]);
            }
        }
        aggregated.push(row);
    });

    return aggregated.sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
}

function getHourlyAggregated(rows) { return getAggregated(rows, 'hourly'); }
function getDailyAggregated(rows) { return getAggregated(rows, 'daily'); }

function convertToChartData(rows, timeframe = 'Hour', metricGroup = 'wind') {
    const normalizedTimeframe = normalizeTimeframe(timeframe);
    const limit = TIMEFRAME_LIMITS[normalizedTimeframe] || TIMEFRAME_LIMITS['Day'];
    let dataRows = rows.slice(-limit);

    const aggregation = AGGREGATION[normalizedTimeframe];
    if (aggregation === 'daily') {
        dataRows = getDailyAggregated(dataRows);
    } else if (aggregation) {
        dataRows = getAggregated(dataRows, aggregation);
    }

    const timestamps = dataRows.map(r => r.timestamp);
    const showDate = shouldShowDate(timestamps);
    const labels = dataRows.map(r => formatLabel(r.timestamp, normalizedTimeframe, showDate));

    const groupParams = GROUPS[metricGroup] || GROUPS['wind'];
    const datasets = groupParams.map(param => {
        const config = METRIC_CONFIG[param];
        return {
            label: `${config.label} (${config.unit})`,
            data: dataRows.map(r => {
                let val = r[param];
                if (val == null) return null;
                if (config.transform) val = config.transform(val);
                return Math.round(val * 10) / 10;
            }),
            borderColor: config.color,
            backgroundColor: `${config.color}1A`,
            borderWidth: 2,
            fill: param !== 'windDirection',
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: config.yAxisID || 'y',
            configParam: param
        };
    });

    return { labels, datasets };
}

function getCurrentValues(rows) {
    if (!rows || rows.length === 0) return null;
    const latest = rows[rows.length - 1];

    const current = {};
    for (const [param, config] of Object.entries(METRIC_CONFIG)) {
        let val = latest[param];
        if (val != null && config.transform) val = config.transform(val);
        current[param] = val;
    }
    return current;
}

async function loadData(stationCode = 'BOU', timeframe = 'Hourly', metricGroup = 'wind') {
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
            if (window.toast) window.toast('Unable to connect. Please check your internet.');
            throw error;
        }
    } else if (rawRows instanceof Promise) {
        rawRows = await rawRows;
    }

    const currentValues = getCurrentValues(rawRows);
    const chartData = convertToChartData(rawRows, timeframe, metricGroup);
    return { ...chartData, current: currentValues };
}

let currentChart = null;

function getData() {
    const data = dataCache.get('windData');
    if (data instanceof Promise) throw new Error('Data not loaded');
    return data;
}

function createChart(ctx, chartData, metricGroup = 'wind') {
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    const groupParams = GROUPS[metricGroup] || GROUPS['wind'];
    const hasY1 = groupParams.some(p => METRIC_CONFIG[p].yAxisID === 'y1');
    const primaryUnit = METRIC_CONFIG[groupParams[0]].unit;

    const scales = {
        x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkipPadding: 10 }
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: metricGroup !== 'pressure' && metricGroup !== 'temperature' && metricGroup !== 'radiation',
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: { callback: v => v + ' ' + primaryUnit }
        }
    };

    if (hasY1) {
        const y1Metric = groupParams.find(p => METRIC_CONFIG[p].yAxisID === 'y1');
        const y1Config = METRIC_CONFIG[y1Metric];
        scales.y1 = {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: y1Config.unit == '°',
            max: y1Config.unit === '°' ? 360 : undefined,
            grid: { drawOnChartArea: false },
            ticks: { callback: v => v + ' ' + y1Config.unit }
        };
    }

    currentChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { usePointStyle: true, padding: 15 }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#fff',
                    borderWidth: 1
                },
                verticalLine: {}
            },
            scales: scales,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            onClick: (event, activeElements, chart) => {
                if (activeElements.length > 0) {
                    const dataIndex = activeElements[0].index;
                    const time = chart.data.labels[dataIndex];
                    chart._verticalLineX = time;

                    document.querySelectorAll('table tbody tr.highlighted').forEach(tr => tr.classList.remove('highlighted'));
                    const tableRows = document.querySelectorAll('table tbody tr');
                    tableRows.forEach(tr => {
                        const timeCell = tr.querySelector('td:first-child');
                        if (timeCell && timeCell.textContent.trim() === time) {
                            tr.classList.add('highlighted');
                             tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    });
                }
            }
        }
    });
}

function populateTable(table, data, metricGroup = 'wind') {
    if (!table) return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (!data || !data.datasets || data.datasets.length === 0) return;

    const groupParams = GROUPS[metricGroup] || GROUPS['wind'];

    const headerRow = document.createElement('tr');
    const timeTh = document.createElement('th');
    timeTh.textContent = 'Time';
    headerRow.appendChild(timeTh);

    groupParams.forEach(param => {
        const config = METRIC_CONFIG[param];
        const th = document.createElement('th');
        th.textContent = config.label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const numCols = groupParams.length + 1;
    const tableCard = table.closest('.visualization.card.table');
    if (tableCard) {
        if (numCols <= 2) {
            tableCard.style.flexBasis = '250px';
        } else {
            tableCard.style.flexBasis = '';
        }
    }

    const { labels, datasets } = data;
    const reversedLabels = [...labels].reverse();
    const reversedDatasets = datasets.map(d => [...(d.data || [])].reverse());

    reversedLabels.forEach((label, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';

        const tdTime = document.createElement('td');
        tdTime.innerHTML = label;
        tr.dataset.time = label;
        tr.appendChild(tdTime);

        reversedDatasets.forEach((revData, dsIndex) => {
            const param = groupParams[dsIndex];
            const config = METRIC_CONFIG[param];
            const val = revData[i];

            const decimals = config.decimals !== undefined ? config.decimals : 1;
            const td = document.createElement('td');
            if (val != null) {
                const fmtVal = Number(val).toFixed(decimals);
                td.textContent = `${fmtVal}`;
            } else {
                td.textContent = '--';
            }
            tr.appendChild(td);
        });

        tr.onclick = () => {
            const isHighlighted = tr.classList.contains('highlighted');
            document.querySelectorAll('table tbody tr.highlighted').forEach(row => row.classList.remove('highlighted'));
            
            if (!isHighlighted) {
                tr.classList.add('highlighted');
                if (currentChart) {
                    const label = tr.dataset.time;
                    const index = currentChart.data.labels.indexOf(label);
                    if (index !== -1) {
                        const meta = currentChart.getDatasetMeta(0);
                        const point = meta.data[index];
                        
                        if (point) {
                            const activeElements = currentChart.data.datasets.map((_, i) => ({
                                datasetIndex: i,
                                index: index
                            }));
                            currentChart._verticalLineX = label;
                            currentChart.tooltip.setActiveElements(activeElements, { x: point.x, y: point.y });
                            currentChart.update();
                        }
                    }
                }
            } else if (currentChart) {
                currentChart._verticalLineX = null;
                currentChart.tooltip.setActiveElements([], { x: 0, y: 0 });
                currentChart.update();
            }
        };
        tbody.appendChild(tr);
    });
}

function createEmptyChart(ctx, metricGroup = 'wind') {
    const groupParams = GROUPS[metricGroup] || GROUPS['wind'];
    const datasets = groupParams.map(param => {
        const config = METRIC_CONFIG[param];
        return {
            label: `${config.label} (${config.unit})`,
            data: [null],
            borderColor: config.color,
            backgroundColor: `${config.color}1A`,
            borderWidth: 2,
            fill: param !== 'windDirection',
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            yAxisID: config.yAxisID || 'y',
            configParam: param
        };
    });

    createChart(ctx, {
        labels: ['--'],
        datasets: datasets
    }, metricGroup);
}

window.WindDashboard = { loadData, getData, createChart, populateTable, createEmptyChart, GROUPS, METRIC_TO_GROUP };
