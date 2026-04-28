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

const METRIC_CONFIG = {
    temperature: { label: 'Temperature', unit: '°C', color: '#E24B4A', agg: 'avg' },
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

// TODO: Move CSV Parsing and Aggregation logic to a Web Worker to keep UI responsive.

function createChart(ctx, chartData, metricGroup = 'wind') {
    // Keep chart creation logic for now, but it should be refactored to use a unified data model.
}

function populateTable(table, data, metricGroup = 'wind') {
    // Keep table population skeleton, but it should be refactored to use a unified data model.
}

window.WindDashboard = { createChart, populateTable, GROUPS, METRIC_TO_GROUP };
