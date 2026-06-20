export function buildNewsApiUrl({
  category,
  country,
  region = '',
  city = '',
  language = 'en',
  q = '',
  forceFresh = false,
}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  else params.set('category', category || 'top');
  params.set('country', country || 'IN');
  params.set('language', language || 'en');
  if (!q && category === 'local' && region) params.set('region', region);
  if (!q && category === 'local' && city) params.set('city', city);
  if (forceFresh) params.set('fresh', String(Date.now()));
  return `/api/news?${params.toString()}`;
}

export async function fetchNewsJson(options) {
  const response = await fetch(buildNewsApiUrl(options), {
    cache: options?.forceFresh ? 'no-store' : 'default',
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'News fetch failed');
  return data;
}
