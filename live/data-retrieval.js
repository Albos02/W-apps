const STATION_LIST_PATH = '../assets/coord_station_meteosuisse.json'
const VQHA80_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv'
const OGD_SMN_BASE = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn'
const CACHE_TTL = 10 * 60 * 1000

const PARAM_NAMES = {
  tre200s0: 'temperature',
  ure200s0: 'humidity',
  tde200s0: 'dewPoint',
  dkl010z0: 'windDirection',
  fu3010z0: 'windAvg',
  fu3010z1: 'windGusts',
  rre150z0: 'precipitation',
  sre000z0: 'sunshine',
  gre000z0: 'globalRadiation',
  prestas0: 'pressure',
  pp0qffs0: 'pressureQff',
  pp0qnhs0: 'pressureQnh',
}

let stationsCache = null

export async function loadStationList() {
  if (stationsCache) return stationsCache
  const res = await fetch(STATION_LIST_PATH)
  const raw = await res.json()
  stationsCache = raw
    .filter(entry => entry[0] && entry[1])
    .map(entry => ({
      code: entry[0],
      lat: parseFloat(entry[1]),
      lon: parseFloat(entry[2]),
      name: entry[3] ? entry[3].replace(' / ', '/') : entry[3],
      canton: entry[4],
      index: entry[5],
    }))
  return stationsCache
}

let currentCache = {}
let currentCacheTime = 0

export async function fetchCurrentValuesForStation(stationCode) {
  const now = Date.now()
  if (currentCache[stationCode] && (now - currentCacheTime) < CACHE_TTL) {
    return currentCache[stationCode]
  }
  const lower = stationCode.toLowerCase()
  const res = await fetch(`${OGD_SMN_BASE}/${lower}/ogd-smn_${lower}_t_now.csv`).catch(() => null)
  if (!res?.ok) return null
  const csv = await res.text()
  const rows = parseTimeSeriesCSV(csv)
  const latest = rows.length > 0 ? rows[rows.length - 1] : null
  if (latest) {
    currentCache[stationCode] = latest
    currentCacheTime = now
  }
  return latest
}

function parseTimestampDDMMYYYY(val) {
  const [d, m, y, hh, mi] = val.split(/[\s.:\/-]+/)
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${(hh || '00').padStart(2, '0')}:${(mi || '00').padStart(2, '0')}:00`
}

function parseTimeSeriesCSV(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(';').map(h => h.trim())
  const results = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';')
    if (!cols[1]) continue
    const record = {
      stationCode: cols[0],
      timestamp: parseTimestampDDMMYYYY(cols[1]),
    }
    for (let j = 2; j < cols.length; j++) {
      const paramKey = header[j]
      const mapped = PARAM_NAMES[paramKey]
      if (mapped && cols[j] && cols[j] !== '-') {
        record[mapped] = parseFloat(cols[j])
      }
    }
    results.push(record)
  }
  return results
}

let timeSeriesCache = {}
let timeSeriesCacheTimes = {}

export async function fetchTimeSeries(stationCode) {
  const now = Date.now()
  if (timeSeriesCache[stationCode] && (now - (timeSeriesCacheTimes[stationCode] || 0)) < CACHE_TTL) {
    return timeSeriesCache[stationCode]
  }
  const lower = stationCode.toLowerCase()
  const [nowRes, recentRes] = await Promise.all([
    fetch(`${OGD_SMN_BASE}/${lower}/ogd-smn_${lower}_t_now.csv`).catch(() => null),
    fetch(`${OGD_SMN_BASE}/${lower}/ogd-smn_${lower}_t_recent.csv`).catch(() => null),
  ])
  const all = []
  if (nowRes?.ok) all.push(...parseTimeSeriesCSV(await nowRes.text()))
  if (recentRes?.ok) all.push(...parseTimeSeriesCSV(await recentRes.text()))
  const seen = new Set()
  const deduped = []
  for (const r of all) {
    if (!seen.has(r.timestamp)) {
      seen.add(r.timestamp)
      deduped.push(r)
    }
  }
  deduped.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  timeSeriesCache[stationCode] = deduped
  timeSeriesCacheTimes[stationCode] = now
  return deduped
}

export function clearCache() {
  currentCache = null
  currentCacheTime = 0
  timeSeriesCache = {}
  timeSeriesCacheTimes = {}
}
