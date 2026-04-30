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



const GRANULARITY_MAP = {
    'Hourly': 'h',
    'Daily': 'd',
    'Monthly': 'm'
};


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
