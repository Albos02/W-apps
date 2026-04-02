const METEOSWISS_BASE_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn';

const REALTIME_ENDPOINTS = {
    temperature: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-lufttemperatur-10min/ch.meteoschweiz.messwerte-lufttemperatur-10min_en.json',
    humidity: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min_en.json',
    windGusts: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min/ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min_en.json',
    precipitation: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-niederschlag-10min/ch.meteoschweiz.messwerte-niederschlag-10min_en.json',
    sunshine: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-sonnenscheindauer-10min/ch.meteoschweiz.messwerte-sonnenscheindauer-10min_en.json',
    globalRadiation: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-globalstrahlung-10min/ch.meteoschweiz.messwerte-globalstrahlung-10min_en.json',
    dewPoint: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-taupunkt-10min/ch.meteoschweiz.messwerte-taupunkt-10min_en.json'
};

const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 20;
const realtimeCache = new Map();

function pruneCache() {
    if (realtimeCache.size < MAX_CACHE_SIZE) return;
    
    const entries = [...realtimeCache.entries()];
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2));
    toRemove.forEach(([key]) => realtimeCache.delete(key));
}

const COLUMN_MAPPING = {
    tre200s0: { label: 'Temperature', unit: '°C' },
    tre200h0: { label: 'Temperature', unit: '°C' },
    tre200d0: { label: 'Temperature', unit: '°C' },
    tre200m0: { label: 'Temperature', unit: '°C' },
    ure200s0: { label: 'Humidity', unit: '%' },
    ure200h0: { label: 'Humidity', unit: '%' },
    ure200d0: { label: 'Humidity', unit: '%' },
    ure200m0: { label: 'Humidity', unit: '%' },
    prestas0: { label: 'Pressure (QFE)', unit: 'hPa' },
    prestah0: { label: 'Pressure (QFE)', unit: 'hPa' },
    prestad0: { label: 'Pressure (QFE)', unit: 'hPa' },
    prestam0: { label: 'Pressure (QFE)', unit: 'hPa' },
    pp0qffs0: { label: 'Pressure (QFF)', unit: 'hPa' },
    pp0qnhs0: { label: 'Pressure (QNH)', unit: 'hPa' },
    fu3010z0: { label: 'Wind Speed', unit: 'km/h' },
    fu3010h0: { label: 'Wind Speed', unit: 'km/h' },
    fu3010d0: { label: 'Wind Speed', unit: 'km/h' },
    fu3010m0: { label: 'Wind Speed', unit: 'km/h' },
    fu3010z1: { label: 'Wind Gusts', unit: 'km/h' },
    fu3010h1: { label: 'Wind Gusts', unit: 'km/h' },
    fu3010d1: { label: 'Wind Gusts', unit: 'km/h' },
    fu3010m1: { label: 'Wind Gusts', unit: 'km/h' },
    fkl010z0: { label: 'Wind Speed', unit: 'km/h' },
    fkl010h0: { label: 'Wind Speed', unit: 'km/h' },
    fkl010d0: { label: 'Wind Speed', unit: 'km/h' },
    fkl010m0: { label: 'Wind Speed', unit: 'km/h' },
    fkl010z1: { label: 'Wind Gusts', unit: 'km/h' },
    fkl010h1: { label: 'Wind Gusts', unit: 'km/h' },
    fkl010d1: { label: 'Wind Gusts', unit: 'km/h' },
    fkl010m1: { label: 'Wind Gusts', unit: 'km/h' },
    dkl010z0: { label: 'Wind Direction', unit: '°' },
    dkl010h0: { label: 'Wind Direction', unit: '°' },
    dkl010d0: { label: 'Wind Direction', unit: '°' },
    rre150z0: { label: 'Precipitation', unit: 'mm' },
    rre150h0: { label: 'Precipitation', unit: 'mm' },
    rre150d0: { label: 'Precipitation', unit: 'mm' },
    rre150m0: { label: 'Precipitation', unit: 'mm' },
    gre000z0: { label: 'Global Radiation', unit: 'W/m²' },
    gre000h0: { label: 'Global Radiation', unit: 'W/m²' },
    gre000d0: { label: 'Global Radiation', unit: 'W/m²' },
    gre000m0: { label: 'Global Radiation', unit: 'W/m²' },
    sre000z0: { label: 'Sunshine Duration', unit: 'min' },
    sre000h0: { label: 'Sunshine Duration', unit: 'min' },
    sre000d0: { label: 'Sunshine Duration', unit: 'min' },
    sre000m0: { label: 'Sunshine Duration', unit: 'min' }
};

const WIND_COLUMNS = [
    'fu3010z0', 'fu3010h0', 'fu3010d0', 'fu3010m0',
    'fu3010z1', 'fu3010h1', 'fu3010d1', 'fu3010m1',
    'fkl010z0', 'fkl010h0', 'fkl010d0', 'fkl010m0',
    'fkl010z1', 'fkl010h1', 'fkl010d1', 'fkl010m1'
];

const GRANULARITY_MAP = {
    'Hourly': 'h',
    'Daily': 'd',
    'Monthly': 'm'
};

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        if (values.length < headers.length) continue;

        const row = {};
        headers.forEach((header, index) => {
            let value = values[index]?.trim();
            
            if (WIND_COLUMNS.includes(header)) {
                const num = parseFloat(value);
                row[header] = isNaN(num) ? null : Math.round(num * 3.6 * 10) / 10;
            } else {
                row[header] = isNaN(parseFloat(value)) ? value : parseFloat(value);
            }
        });

        if (row.station_abbr) {
            rows.push(row);
        }
    }

    return { headers, rows };
}

function formatTimestamp(value, granularity) {
    if (!value) return null;

    let date;
    if (granularity === 'h' || granularity === 't') {
        const [datePart, timePart] = value.split(' ');
        const [day, month, year] = datePart.split('.');
        const [hour, minute] = timePart.split(':');
        date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
    } else if (granularity === 'd') {
        const [day, month, year] = value.split('.');
        date = new Date(`${year}-${month}-${day}T12:00:00Z`);
    } else if (granularity === 'm') {
        const [month, year] = value.split('.');
        date = new Date(`${year}-${month}-15T12:00:00Z`);
    }

    return date ? date.toISOString() : value;
}

function transformToHumanReadable(data, granularity) {
    const { headers, rows } = data;

    return rows.map(row => {
        const transformed = {
            timestamp: formatTimestamp(row.reference_timestamp, granularity),
            datetime: row.reference_timestamp
        };

        headers.forEach(header => {
            if (header === 'station_abbr' || header === 'reference_timestamp') return;

            const mapping = COLUMN_MAPPING[header];
            if (mapping) {
                const key = mapping.label.replace(/\s+/g, '_');
                transformed[key] = row[header];
                transformed[`${key}_unit`] = mapping.unit;
            } else if (row[header] !== undefined) {
                transformed[header] = row[header];
            }
        });

        return transformed;
    });
}

function buildURL(stationId, granularity, isHistorical) {
    const gran = GRANULARITY_MAP[granularity] || 'h';
    const period = isHistorical ? 'historical' : 'now';
    const type = 't';
    
    return `${METEOSWISS_BASE_URL}/${stationId.toLowerCase()}/ogd-smn_${stationId.toLowerCase()}_${type}_${period}.csv`;
}

async function fetchStationData(stationId, granularity = 'Hourly', isHistorical = false) {
    const url = buildURL(stationId, granularity, isHistorical);

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`No data available for station ${stationId} with granularity ${granularity}`);
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        const parsedData = parseCSV(text);
        const transformedData = transformToHumanReadable(parsedData, GRANULARITY_MAP[granularity]);

        return transformedData;

    } catch (error) {
        console.error(`Error fetching station data for ${stationId}:`, error);
        if (window.toast) window.toast('Unable to connect. Please check your internet.');
        throw error;
    }
}

function getChartData(stationId, granularity = 'Hourly', isHistorical = false) {
    return fetchStationData(stationId, granularity, isHistorical).then(data => {
        if (!data || data.length === 0) {
            return { labels: [], datasets: [] };
        }

        const labels = data.map(d => d.datetime);
        
        const datasets = [];

        if (data[0].Temperature !== undefined) {
            datasets.push({
                label: 'Temperature (°C)',
                data: data.map(d => d.Temperature),
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            });
        }

        if (data[0].Wind_Speed !== undefined) {
            datasets.push({
                label: 'Wind Speed (km/h)',
                data: data.map(d => d.Wind_Speed),
                borderColor: '#0087f2',
                backgroundColor: 'rgba(0, 135, 242, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            });
        }

        if (data[0].Wind_Gusts !== undefined) {
            datasets.push({
                label: 'Wind Gusts (km/h)',
                data: data.map(d => d.Wind_Gusts),
                borderColor: '#ff9f43',
                backgroundColor: 'rgba(255, 159, 67, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            });
        }

        if (data[0].Humidity !== undefined) {
            datasets.push({
                label: 'Humidity (%)',
                data: data.map(d => d.Humidity),
                borderColor: '#26de81',
                backgroundColor: 'rgba(38, 222, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            });
        }

        if (data[0].Pressure_QFE !== undefined) {
            datasets.push({
                label: 'Pressure QFE (hPa)',
                data: data.map(d => d.Pressure_QFE),
                borderColor: '#a55eea',
                backgroundColor: 'rgba(165, 94, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            });
        }

        return { labels, datasets };
    });
}

async function fetchRealtimeData(stationId) {
    const results = {
        station_id: stationId,
        timestamp: null,
        data: {}
    };

    try {
        const endpoints = [
            { key: 'temperature', url: REALTIME_ENDPOINTS.temperature },
            { key: 'humidity', url: REALTIME_ENDPOINTS.humidity },
            { key: 'windGusts', url: REALTIME_ENDPOINTS.windGusts },
            { key: 'precipitation', url: REALTIME_ENDPOINTS.precipitation },
            { key: 'sunshine', url: REALTIME_ENDPOINTS.sunshine },
            { key: 'globalRadiation', url: REALTIME_ENDPOINTS.globalRadiation },
            { key: 'dewPoint', url: REALTIME_ENDPOINTS.dewPoint }
        ];

        const promises = endpoints.map(async ({ key, url }) => {
            try {
                const response = await fetch(url);
                if (!response.ok) return { key, data: null };
                
                const json = await response.json();
                const stationFeature = json.features?.find(f => f.id === stationId);
                
                if (!stationFeature) return { key, data: null };
                
                if (!results.timestamp) {
                    results.timestamp = stationFeature.properties.reference_ts;
                }
                
                return {
                    key,
                    data: {
                        value: stationFeature.properties.value,
                        unit: stationFeature.properties.unit,
                        timestamp: stationFeature.properties.reference_ts,
                        wind_direction: stationFeature.properties.wind_direction
                    }
                };
            } catch (e) {
                console.warn(`Failed to fetch ${key}:`, e);
                if (window.toast) window.toast('Unable to connect. Please check your internet.');
                return { key, data: null };
            }
        });

        const responses = await Promise.all(promises);
        
        responses.forEach(({ key, data }) => {
            if (data) {
                results.data[key] = data;
            }
        });

    } catch (error) {
        console.error('Error fetching realtime data:', error);
        if (window.toast) window.toast('Unable to connect. Please check your internet.');
    }

    return results;
}

function transformRealtimeData(realtimeData) {
    if (!realtimeData || !realtimeData.data) return null;
    
    const { data, timestamp, station_id } = realtimeData;
    
    return {
        station_id,
        timestamp,
        Temperature: data.temperature?.value ?? null,
        Temperature_unit: data.temperature?.unit ?? '°C',
        Humidity: data.humidity?.value ?? null,
        Humidity_unit: data.humidity?.unit ?? '%',
        Wind_Gusts: data.windGusts?.value ?? null,
        Wind_Gusts_unit: data.windGusts?.unit ?? 'km/h',
        Wind_Direction: data.windGusts?.wind_direction ?? null,
        Precipitation: data.precipitation?.value ?? null,
        Precipitation_unit: data.precipitation?.unit ?? 'mm',
        Sunshine: data.sunshine?.value ?? null,
        Sunshine_unit: data.sunshine?.unit ?? 'min',
        Global_Radiation: data.globalRadiation?.value ?? null,
        Global_Radiation_unit: data.globalRadiation?.unit ?? 'W/m²',
        Dew_Point: data.dewPoint?.value ?? null,
        Dew_Point_unit: data.dewPoint?.unit ?? '°C'
    };
}

async function getCurrentWeather(stationId) {
    const cacheKey = stationId;
    const cached = realtimeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    
    pruneCache();
    
    const realtimeData = await fetchRealtimeData(stationId);
    const result = transformRealtimeData(realtimeData);
    
    realtimeCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
    });
    
    return result;
}

window.MeteoSwiss = {
    fetchStationData,
    getChartData,
    fetchRealtimeData,
    getCurrentWeather,
    transformRealtimeData,
    COLUMN_MAPPING,
    GRANULARITY_MAP,
    WIND_COLUMNS,
    REALTIME_ENDPOINTS
};
