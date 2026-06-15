import https from 'node:https';

const COUNTRY_NAMES = {
  AE: 'United Arab Emirates',
  AU: 'Australia',
  BD: 'Bangladesh',
  BR: 'Brazil',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  KR: 'South Korea',
  NL: 'Netherlands',
  PK: 'Pakistan',
  RU: 'Russia',
  SG: 'Singapore',
  US: 'United States',
  ZA: 'South Africa',
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=900',
  'Content-Type': 'application/json; charset=utf-8',
};

function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 7000, headers: { 'User-Agent': 'NewsSetu/1.0' } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects > 2) {
          reject(new Error('Too many location redirects'));
          return;
        }
        resolve(fetchJson(new URL(response.headers.location, url).toString(), redirects + 1));
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Location request failed with ${response.statusCode}`));
        return;
      }

      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => request.destroy(new Error('Location request timed out')));
    request.on('error', reject);
  });
}

function normalizeCountry(country = 'IN') {
  const value = country.toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : 'IN';
}

function countryLabel(country = 'IN') {
  const value = normalizeCountry(country);
  if (COUNTRY_NAMES[value]) return COUNTRY_NAMES[value];
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(value) || value;
  } catch {
    return value;
  }
}

function clientIp(event) {
  const forwarded = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'] || '';
  const headerIp =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    event.headers['x-real-ip'] ||
    forwarded.split(',')[0];
  return (headerIp || '').trim();
}

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const lat = event.queryStringParameters?.lat;
    const lon = event.queryStringParameters?.lon;

    if (validCoordinate(lat, -90, 90) && validCoordinate(lon, -180, 180)) {
      const geo = await fetchJson(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
      );
      const country = normalizeCountry(geo.countryCode);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          country,
          countryName: countryLabel(country),
          city: geo.city || geo.locality || '',
          region: geo.principalSubdivision || '',
          source: 'gps',
        }),
      };
    }

    const ip = clientIp(event);
    const ipUrl = ip
      ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : 'https://ipapi.co/json/';
    const geo = await fetchJson(ipUrl);
    const country = normalizeCountry(geo.country_code);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        country,
        countryName: countryLabel(country),
        city: geo.city || '',
        region: geo.region || '',
        source: 'ip',
      }),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        country: 'IN',
        countryName: countryLabel('IN'),
        source: 'fallback',
        error: error.message,
      }),
    };
  }
};
