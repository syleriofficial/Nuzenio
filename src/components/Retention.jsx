import { useEffect, useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { trackEvent } from '../services/analytics.js';

const DEFAULT_CATEGORIES = ['top', 'local', 'business', 'tech', 'sports'];

export function Newsletter({ copy, language, location }) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function subscribe(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage('Enter a valid email address.');
      return;
    }
    if (!consent) {
      setMessage('Confirm consent to receive Nuzenio emails.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          frequency,
          country: location.country,
          categories: DEFAULT_CATEGORIES,
          consent,
          source: 'site-sidebar',
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(data.error || 'Subscription could not be saved. Please try again.');
        return;
      }
      setMessage(data.emailQueued ? 'Check your email to confirm the Nuzenio brief.' : 'Double opt-in saved. Email sending is ready when provider webhook is connected.');
      setEmail('');
      setConsent(false);
      trackEvent('newsletter_subscribe', {
        method: 'double_opt_in',
        language: language.code,
        frequency,
        country: location.country,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="railCard" onSubmit={subscribe}>
      <h3>
        <Mail size={18} /> {copy.dailyBrief}
      </h3>
      <p>Top, local, business, tech, and sports headlines. Double opt-in, no spam.</p>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={copy.email}
        type="email"
        autoComplete="email"
        aria-label="Email address for Nuzenio daily brief"
      />
      <select value={frequency} onChange={(event) => setFrequency(event.target.value)} aria-label="Digest frequency">
        <option value="daily">Daily digest</option>
        <option value="weekly">Weekly digest</option>
      </select>
      <label className="consentCheck">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>I agree to receive Nuzenio news digest emails and can unsubscribe anytime.</span>
      </label>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Subscribing...' : copy.subscribe}</button>
      <small className="newsletterNote">Includes unsubscribe link in every email.</small>
      {message && <small>{message}</small>}
    </form>
  );
}

export function RetentionPanel({ location, supabase, user }) {
  const [notificationPermission, setNotificationPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const [preferences, setPreferences] = useState({
    preferred_country: location.country || 'IN',
    preferred_categories: DEFAULT_CATEGORIES,
    digest_frequency: 'daily',
    email_notifications: false,
    push_notifications: false,
    marketing_consent: false,
    breaking_alerts: false,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPreferences({
          preferred_country: data.preferred_country || location.country || 'IN',
          preferred_categories: data.preferred_categories?.length ? data.preferred_categories : DEFAULT_CATEGORIES,
          digest_frequency: data.digest_frequency || 'daily',
          email_notifications: Boolean(data.email_notifications),
          push_notifications: Boolean(data.push_notifications),
          marketing_consent: Boolean(data.marketing_consent),
          breaking_alerts: Boolean(data.metadata?.breaking_alerts),
        });
      });
  }, [user?.id]);

  function toggleCategory(category) {
    setPreferences((current) => {
      const next = current.preferred_categories.includes(category)
        ? current.preferred_categories.filter((item) => item !== category)
        : [...current.preferred_categories, category];
      return { ...current, preferred_categories: next.length ? next : [category] };
    });
  }

  async function savePreferences() {
    if (!supabase || !user) {
      setMessage('Login to save personalized Nuzenio preferences.');
      return;
    }
    const payload = {
      user_id: user.id,
      ...preferences,
      metadata: { breaking_alerts: preferences.breaking_alerts },
      preferred_country: String(preferences.preferred_country || 'IN').toUpperCase(),
    };
    const { error } = await supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Preferences saved for future digest and notification features.');
    trackEvent('save_preferences', {
      country: payload.preferred_country,
      categories: payload.preferred_categories.join(','),
      digest_frequency: payload.digest_frequency,
    });
  }

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setNotificationPermission(nextPermission);
    if (nextPermission === 'granted') {
      setPreferences((current) => ({
        ...current,
        push_notifications: true,
        breaking_alerts: true,
      }));
      trackEvent('notification_permission', { status: 'granted' });
    } else {
      trackEvent('notification_permission', { status: nextPermission });
    }
  }

  return (
    <div className="railCard retentionPanel">
      <h3>
        <ShieldCheck size={18} /> Reader preferences
      </h3>
      <p>Personalize country, topics, saved stories, reading history, and future notifications.</p>
      <input
        value={preferences.preferred_country}
        onChange={(event) => setPreferences({ ...preferences, preferred_country: event.target.value.toUpperCase() })}
        aria-label="Preferred country"
      />
      <select
        value={preferences.digest_frequency}
        onChange={(event) => setPreferences({ ...preferences, digest_frequency: event.target.value })}
        aria-label="Digest frequency"
      >
        <option value="daily">Daily digest</option>
        <option value="weekly">Weekly digest</option>
        <option value="off">No digest</option>
      </select>
      <div className="preferenceChips">
        {DEFAULT_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={preferences.preferred_categories.includes(category) ? 'active' : ''}
            onClick={() => toggleCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <label className="consentCheck">
        <input
          type="checkbox"
          checked={preferences.email_notifications}
          onChange={(event) => setPreferences({ ...preferences, email_notifications: event.target.checked, marketing_consent: event.target.checked })}
        />
        <span>Email notification ready</span>
      </label>
      <label className="consentCheck">
        <input
          type="checkbox"
          checked={preferences.push_notifications}
          onChange={(event) => setPreferences({ ...preferences, push_notifications: event.target.checked })}
        />
        <span>Future push notifications</span>
      </label>
      <label className="consentCheck">
        <input
          type="checkbox"
          checked={preferences.breaking_alerts}
          onChange={(event) => setPreferences({ ...preferences, breaking_alerts: event.target.checked })}
        />
        <span>Breaking news alerts</span>
      </label>
      <button type="button" onClick={requestNotificationPermission} disabled={notificationPermission === 'granted' || notificationPermission === 'unsupported'}>
        {notificationPermission === 'granted' ? 'Notifications allowed' : notificationPermission === 'unsupported' ? 'Notifications unsupported' : 'Enable notifications'}
      </button>
      <button onClick={savePreferences}>Save preferences</button>
      <small>{user ? 'Stored privately in your Nuzenio account.' : 'Login required to sync preferences.'}</small>
      {message && <small>{message}</small>}
    </div>
  );
}
