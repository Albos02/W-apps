/* 
   ARCHIVED: GeoJSON Real-time Logic
   This source is currently disabled to simplify the architecture.
   The CSV source from historical-fetcher.js is now the primary source of truth for all data.
*/

const REALTIME_ENDPOINTS = {
    temperature: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-lufttemperatur-10min/ch.meteoschweiz.messwerte-lufttemperatur-10min_en.json',
    humidity: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min_en.json',
    windGusts: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min/ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min_en.json',
    precipitation: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-niederschlag-10min/ch.meteoschweiz.messwerte-niederschlag-10min_en.json',
    sunshine: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-sonnenscheindauer-10min/ch.meteoschweiz.messwerte-sonnenscheindauer-10min_en.json',
    globalRadiation: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-globalstrahlung-10min/ch.meteoschweiz.messwerte-globalstrahlung-10min_en.json',
    dewPoint: 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-taupunkt-10min/ch.meteoschweiz.messwerte-taupunkt-10min_en.json'
};

/**
 * @deprecated Use historical-fetcher.js to get the latest values from the CSV time-series.
 */
async function fetchRealtimeData(stationId) {
    console.warn("fetchRealtimeData (GeoJSON) is deprecated. Use CSV source instead.");
    const results = {
        station_id: stationId,
        timestamp: null,
        data: {}
    };

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
        const response = await fetch(url);
        if (!response.ok) return { key, data: null };
        const json = await response.json();
        const stationFeature = json.features?.find(f => f.id === stationId);
        return { key, data: stationFeature?.properties || null };
    });

    const responses = await Promise.all(promises);
    responses.forEach(({ key, data }) => { if (data) results.data[key] = data; });
    return results;
}

window.MeteoSwiss = {
    fetchRealtimeData,
    REALTIME_ENDPOINTS,
    getCurrentWeather: async () => {
        console.warn("MeteoSwiss.getCurrentWeather (GeoJSON) is disabled.");
        return null;
    }
};
