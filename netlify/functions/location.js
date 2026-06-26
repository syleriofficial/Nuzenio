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
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

function fetchJson(url, redirects = 0, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 8000, headers: { 'User-Agent': 'Nuzenio/1.0 (https://nuzenio.com)', ...extraHeaders } }, (response) => {
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

function locationPayload({ country, city = '', region = '', source, accuracy = 'city', confidence = 0.6, coordinateAccuracy = null }) {
  const countryCode = normalizeCountry(country);
  return {
    ok: true,
    country: countryCode,
    countryName: countryLabel(countryCode),
    city: city || '',
    region: region || '',
    source,
    accuracy,
    confidence,
    coordinateAccuracy,
  };
}

function firstValue(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

async function openStreetMapReverseLocation(lat, lon) {
  const geo = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=12&addressdetails=1&accept-language=en`,
    0,
    { Referer: 'https://nuzenio.com' },
  );
  const address = geo.address || {};
  const city = firstValue(
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.suburb,
    address.city_district,
    address.county,
  );
  const region = firstValue(address.state, address.region, address.province, address.county);
  return locationPayload({
    country: address.country_code || geo.country_code,
    city,
    region,
    source: 'gps',
    accuracy: city ? 'precise' : 'region',
    confidence: city ? 0.96 : 0.88,
  });
}

async function bigDataCloudReverseLocation(lat, lon) {
  const geo = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
  );
  return locationPayload({
    country: geo.countryCode,
    city: firstValue(geo.city, geo.locality, geo.localityInfo?.administrative?.[2]?.name),
    region: firstValue(geo.principalSubdivision, geo.localityInfo?.administrative?.[1]?.name),
    source: 'gps backup',
    accuracy: geo.city || geo.locality ? 'precise' : 'region',
    confidence: geo.city || geo.locality ? 0.92 : 0.82,
  });
}

async function ipApiLocation(ip) {
  const ipUrl = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : 'https://ipapi.co/json/';
  const geo = await fetchJson(ipUrl);
  if (geo.error) throw new Error(geo.reason || 'IP location unavailable');
  return locationPayload({
    country: geo.country_code,
    city: geo.city,
    region: geo.region,
    source: 'ip',
    accuracy: geo.city ? 'city' : 'region',
    confidence: geo.city ? 0.72 : 0.58,
  });
}

async function ipWhoLocation(ip) {
  const ipUrl = ip
    ? `https://ipwho.is/${encodeURIComponent(ip)}`
    : 'https://ipwho.is/';
  const geo = await fetchJson(ipUrl);
  if (geo.success === false) throw new Error(geo.message || 'IP backup location unavailable');
  return locationPayload({
    country: geo.country_code,
    city: geo.city,
    region: geo.region,
    source: 'ip backup',
    accuracy: geo.city ? 'city' : 'region',
    confidence: geo.city ? 0.68 : 0.55,
  });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        Allow: 'GET, OPTIONS',
      },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  try {
    const lat = event.queryStringParameters?.lat;
    const lon = event.queryStringParameters?.lon;

    if (validCoordinate(lat, -90, 90) && validCoordinate(lon, -180, 180)) {
      const coordinateAccuracy = Number(event.queryStringParameters?.accuracy || 0) || null;
      const errors = [];
      for (const provider of [openStreetMapReverseLocation, bigDataCloudReverseLocation]) {
        try {
          const payload = {
            ...(await provider(lat, lon)),
            coordinateAccuracy,
          };
          if (payload.country && (payload.city || payload.region)) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(payload),
            };
          }
          errors.push(`${payload.source}: incomplete location`);
        } catch (error) {
          errors.push(error.message);
        }
      }
      throw new Error(errors.join('; ') || 'GPS reverse location unavailable');
    }

    const ip = clientIp(event);
    const errors = [];
    for (const provider of [ipApiLocation, ipWhoLocation]) {
      try {
        const payload = await provider(ip);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(payload),
        };
      } catch (error) {
        errors.push(error.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        country: 'US',
        countryName: countryLabel('US'),
        city: '',
        region: '',
        source: 'fallback',
        error: errors.join('; ') || 'Location unavailable',
      }),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        country: 'US',
        countryName: countryLabel('US'),
        city: '',
        region: '',
        source: 'fallback',
        error: error.message,
      }),
    };
  }
};
