import { countryNames } from '../constants/locale.js';
import { readLocal, writeLocal } from './storage.js';

export function normalizeCountry(country) {
  const value = (country || 'IN').toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : 'IN';
}

export function countryLabel(country) {
  const code = normalizeCountry(country);
  if (countryNames[code]) return countryNames[code];
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function placeLabel({ country, region = '', city = '' }) {
  return [city, region, countryLabel(country)].filter(Boolean).join(', ');
}

export function formatLocation(data) {
  const country = normalizeCountry(data.country);
  const approximateNetwork = ['ip', 'ip backup'].includes(data.source);
  const region = data.region || '';
  const city = approximateNetwork ? '' : data.city || '';
  return {
    country,
    region,
    city,
    label: placeLabel({ country, region, city }),
    source: data.source || 'ip',
  };
}

export function compactLocationEntry(location = {}) {
  const country = normalizeCountry(location.country || 'IN');
  const region = String(location.region || '').trim();
  const city = String(location.city || '').trim();
  if (!city) return null;
  return {
    country,
    region,
    city,
    label: placeLabel({ country, region, city }),
  };
}

export function placeKey({ country, region, city }) {
  return `${normalizeCountry(country)}|${String(region || '').toLowerCase()}|${String(city || '').toLowerCase()}`;
}

export function uniquePlacePairs(pairs = []) {
  const seen = new Set();
  return pairs.filter(([region, city]) => {
    const key = `${String(region || '').toLowerCase()}|${String(city || '').toLowerCase()}`;
    if (!city || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readRecentLocalLocations(country) {
  const countryCode = normalizeCountry(country || 'IN');
  return readLocal('nuzenio_recent_locations', [])
    .filter((item) => item?.country === countryCode && item.city)
    .slice(0, 6);
}

export function rememberLocalLocation(location) {
  const entry = compactLocationEntry(location);
  if (!entry) return;
  const existing = readLocal('nuzenio_recent_locations', []);
  const next = [entry, ...existing.filter((item) => placeKey(item) !== placeKey(entry))].slice(0, 20);
  writeLocal('nuzenio_recent_locations', next);
}

export function locationSourceLabel(source) {
  if (source === 'gps') return 'Detected from browser GPS';
  if (source === 'gps backup') return 'Detected from backup GPS lookup';
  if (source === 'ip') return 'Approximate network region';
  if (source === 'ip backup') return 'Approximate backup network region';
  if (source === 'preset') return 'Selected from popular locations';
  if (source === 'manual') return 'Set manually';
  if (source === 'fallback') return 'Using default location';
  return 'Detected from browser region';
}
