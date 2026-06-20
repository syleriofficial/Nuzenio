export function parseConfiguredAffiliateLinks(value = '[]') {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.title && item?.url && /^https:\/\//i.test(item.url))
      .map((item, index) => ({
        id: item.id || `env-affiliate-${index}`,
        title: String(item.title).trim(),
        category: String(item.category || 'news').trim().toLowerCase(),
        url: String(item.url).trim(),
        disclosure: String(item.disclosure || 'Nuzenio may earn a commission from this link.').trim(),
      }));
  } catch {
    return [];
  }
}
