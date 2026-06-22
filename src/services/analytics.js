import { getSupabaseClient } from './supabaseClient.js';

const analyticsId = 'G-7TQQHY9XDV';

export function trackPageView(url, title) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_location: url,
      page_title: title,
      send_to: analyticsId,
    });
  }
  recordAnalyticsEvent('page_view', { page_location: url, page_title: title });
}

export function trackEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, {
      send_to: analyticsId,
      ...params,
    });
  }
  recordAnalyticsEvent(name, params);
}

function recordAnalyticsEvent(name, params = {}) {
  void getSupabaseClient()
    .then((client) => {
      if (!client) return null;
      return client.from('analytics_events').insert({
        event_name: name,
        article_id: params.item_id || params.article_id || null,
        category: params.category || params.content_type || null,
        metadata: params,
      });
    })
    .catch(() => {});
}

export function updateGoogleConsent(consent) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const granted = consent === 'granted';
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
  });
}
