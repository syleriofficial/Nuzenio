'use client';

import { type SyntheticEvent, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronLeft,
  Clock3,
  ExternalLink,
  FileCheck2,
  Flag,
  Languages,
  Link2,
  Share2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { StoryCluster } from '@/lib/story-types';
import { usePreferences } from '@/lib/preferences';

function FactSection({
  kind,
  title,
  items,
}: {
  kind: 'confirmed' | 'developing' | 'disputed';
  title: string;
  items: string[];
}) {
  if (!items.length) return null;
  const icon =
    kind === 'confirmed' ? (
      <Check />
    ) : kind === 'developing' ? (
      <Clock3 />
    ) : (
      <AlertTriangle />
    );
  return (
    <section className={`fact-section ${kind}`}>
      <header>
        {icon}
        <h2>{title}</h2>
      </header>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function StoryDetail({ story }: { story: StoryCluster }) {
  const { language, t } = usePreferences();
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [message, setMessage] = useState('');
  const share = async () => {
    if (navigator.share)
      await navigator.share({
        title: story.headline,
        url: window.location.href,
      });
    else await navigator.clipboard?.writeText(window.location.href);
    setMessage(t('Link copied', 'लिंक कॉपी हुआ'));
  };
  const submitReport = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReported(true);
    setReportOpen(false);
    setMessage(
      t(
        'Issue submitted for editorial review',
        'मुद्दा संपादकीय समीक्षा के लिए भेजा गया',
      ),
    );
  };
  const facts =
    language === 'hi'
      ? {
          confirmed: story.confirmedHi,
          developing: story.developingHi,
          disputed: story.disputedHi,
        }
      : story;
  return (
    <article className="story-detail">
      <Link className="back-link" href={`/?lang=${language}`}>
        <ChevronLeft /> {t('Back to Top', 'मुख्य समाचार पर वापस')}
      </Link>
      <header className="detail-hero">
        <div className="story-meta">
          <Badge variant="outline" className="category-badge">
            {story.category}
          </Badge>
          {story.status !== 'VERIFIED' && (
            <span className={`status ${story.status.toLowerCase()}`}>
              {story.status === 'DISPUTED'
                ? t('Sources differ', 'स्रोत अलग')
                : t('Developing', 'विकासशील')}
            </span>
          )}
          <span>
            <Clock3 /> {t('Updated', 'अपडेट')} {story.updated}
          </span>
        </div>
        <h1>{language === 'hi' ? story.headlineHi : story.headline}</h1>
        <p className="detail-brief">
          {language === 'hi' ? story.briefHi : story.brief}
        </p>
        <div className="attribution-line">
          <div className="source-stack">
            {story.sources.slice(0, 4).map((source) => (
              <span key={source.slug}>{source.short}</span>
            ))}
          </div>
          <span>
            <strong>
              {story.independentSourceCount}{' '}
              {t('independent publisher organisations', 'स्वतंत्र प्रकाशक संगठन')}
            </strong>
            <small>
              {t(
                'Duplicates and syndicated copies excluded',
                'डुप्लिकेट और सिंडिकेटेड प्रतियां हटाई गईं',
              )}
            </small>
          </span>
        </div>
        <div className="detail-actions">
          <Button
            variant={saved ? 'secondary' : 'outline'}
            onClick={() => setSaved(!saved)}
            aria-pressed={saved}
          >
            <Bookmark /> {saved ? t('Saved', 'सेव') : t('Save', 'सेव करें')}
          </Button>
          <Button variant="outline" onClick={share}>
            <Share2 /> {t('Share', 'शेयर')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setReportOpen(!reportOpen)}
            aria-expanded={reportOpen}
          >
            <Flag /> {t('Report issue', 'मुद्दा रिपोर्ट करें')}
          </Button>
        </div>
      </header>
      {language === 'hi' && (
        <div className="translation-label">
          <Languages />{' '}
          {t(
            'Machine-translated from source material; names and figures are preserved.',
            'स्रोत सामग्री से मशीन अनुवाद; नाम और आंकड़े सुरक्षित रखे गए हैं।',
          )}
        </div>
      )}
      {reportOpen && (
        <form className="report-form" onSubmit={submitReport}>
          <div>
            <h2>{t('Report an issue', 'मुद्दा रिपोर्ट करें')}</h2>
            <p>
              {t(
                'Tell the editorial team what may be inaccurate, outdated or unclear.',
                'संपादकीय टीम को बताएं कि क्या गलत, पुराना या अस्पष्ट हो सकता है।',
              )}
            </p>
          </div>
          <label>
            {t('Details', 'विवरण')}
            <Textarea
              required
              minLength={10}
              placeholder={t(
                'Describe the issue and, if possible, name the source.',
                'मुद्दा बताएं और संभव हो तो स्रोत का नाम दें।',
              )}
            />
          </label>
          <div>
            <Button type="submit">{t('Submit', 'भेजें')}</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReportOpen(false)}
            >
              {t('Cancel', 'रद्द करें')}
            </Button>
          </div>
        </form>
      )}
      {reported && (
        <p className="success-banner">
          <Check />{' '}
          {t(
            'Thank you. This cluster is now in the editorial issue queue.',
            'धन्यवाद। यह क्लस्टर अब संपादकीय मुद्दा कतार में है।',
          )}
        </p>
      )}

      <div className="detail-layout">
        <main>
          <section
            className="fact-grid"
            aria-label={t('Fact status', 'तथ्य स्थिति')}
          >
            <FactSection
              kind="confirmed"
              title={t('Confirmed', 'पुष्ट')}
              items={facts.confirmed}
            />
            <FactSection
              kind="developing"
              title={t('Still developing', 'अभी विकासशील')}
              items={facts.developing}
            />
            <FactSection
              kind="disputed"
              title={t('Disputed', 'विवादित')}
              items={facts.disputed}
            />
          </section>
          <section className="detail-section" id="sources">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('Side by side', 'साथ-साथ')}</p>
                <h2>
                  {t('Headline & source comparison', 'हेडलाइन और स्रोत तुलना')}
                </h2>
              </div>
              <span>
                {story.independentSourceCount} {t('organisations', 'संगठन')}
              </span>
            </div>
            <div className="comparison-list">
              {story.sources.map((source) => (
                <article key={`${source.slug}-${source.url}`}>
                  <div className="source-avatar">{source.short}</div>
                  <div>
                    <div className="source-name">
                      <Link href={`/source/${source.slug}?lang=${language}`}>
                        {source.name}
                      </Link>
                      <span>
                        {source.language} · {source.publishedAt}
                      </span>
                    </div>
                    <h3>{source.headline}</h3>
                    {source.machineTranslated && (
                      <small className="machine-label">
                        <Languages />{' '}
                        {t('Machine translation available', 'मशीन अनुवाद उपलब्ध')}
                      </small>
                    )}
                    {source.isSyndicated && (
                      <small className="machine-label">
                        {t(
                          'Syndicated copy · excluded from source count',
                          'सिंडिकेटेड प्रति · स्रोत गणना से बाहर',
                        )}
                      </small>
                    )}
                    <a
                      className="publisher-link"
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('Open original publisher', 'मूल प्रकाशक खोलें')}{' '}
                      <ExternalLink />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('As it happened', 'घटनाक्रम')}</p>
                <h2>{t('Update timeline', 'अपडेट टाइमलाइन')}</h2>
              </div>
            </div>
            <ol className="timeline">
              {story.timeline.map((entry) => (
                <li key={`${entry.at}-${entry.title}`}>
                  <time>{entry.at}</time>
                  <div>
                    <h3>{entry.title}</h3>
                    <p>{entry.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {story.primaryDocument && (
            <section className="detail-section primary-doc">
              <FileCheck2 />
              <div>
                <p className="eyebrow">
                  {t('Primary document', 'प्राथमिक दस्तावेज')}
                </p>
                <h2>{story.primaryDocument.title}</h2>
                <p>
                  {story.primaryDocument.issuer} ·{' '}
                  {story.primaryDocument.publishedAt}
                </p>
                <a
                  className="publisher-link"
                  href={story.primaryDocument.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Open official document', 'आधिकारिक दस्तावेज खोलें')}{' '}
                  <ExternalLink />
                </a>
              </div>
            </section>
          )}
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t('Transparency', 'पारदर्शिता')}</p>
                <h2>
                  {t('Corrections & update history', 'सुधार और अपडेट इतिहास')}
                </h2>
              </div>
            </div>
            {story.corrections.length ? (
              <ul className="corrections-list">
                {story.corrections.map((item) => (
                  <li key={item.at}>
                    <time>{item.at}</time>
                    <span>{item.note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet-copy">
                {t(
                  'No corrections have been recorded for this cluster.',
                  'इस क्लस्टर के लिए कोई सुधार दर्ज नहीं है।',
                )}
              </p>
            )}
          </section>
        </main>
        <aside className="detail-rail">
          <div className="rail-card">
            <p className="eyebrow">{t('How this works', 'यह कैसे काम करता है')}</p>
            <h2>
              {t(
                'One event, not four repeated cards',
                'एक घटना, चार दोहराए कार्ड नहीं',
              )}
            </h2>
            <p className="quiet-copy">
              {t(
                'Nuzenio groups related reporting, consolidates publisher ownership and removes probable wire copies before showing a source count.',
                'Nuzenio संबंधित रिपोर्टिंग को समूहित करता है, प्रकाशक स्वामित्व जोड़ता है और स्रोत गणना से संभावित वायर प्रतियां हटाता है।',
              )}
            </p>
            <Link className="text-link" href="/settings">
              {t('Your feed controls', 'आपकी फीड नियंत्रण')} →
            </Link>
          </div>
          <div className="rail-card">
            <Link2 />
            <strong>{t('Evidence coverage', 'साक्ष्य कवरेज')}</strong>
            <span>
              {t(
                'Every brief sentence maps to at least one listed source or primary document.',
                'हर ब्रीफ वाक्य कम से कम एक सूचीबद्ध स्रोत या प्राथमिक दस्तावेज से जुड़ा है।',
              )}
            </span>
          </div>
        </aside>
      </div>
      <output className="sr-status" aria-live="polite">
        {message}
      </output>
    </article>
  );
}
