import Link from 'next/link';
import type {
  FixtureCard,
  OriginalLanguage,
} from '@/lib/free-source-cards/model';
import { sourceCandidates } from '@/lib/free-source-cards/registry';
import styles from './free-source-preview.module.css';

type Filters = { lang: OriginalLanguage; original: string; source: string };

export function FreeSourcePreview({
  cards,
  filters,
}: {
  cards: FixtureCard[];
  filters: Filters;
}) {
  const { lang, original, source } = filters;
  const t = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const visible = cards.filter(
    (card) =>
      (original === 'all' || card.language === original) &&
      (source === 'all' || card.candidateId === source),
  );
  const languageLink = (language: OriginalLanguage) =>
    `?${new URLSearchParams({ lang: language, original, source }).toString()}`;

  return (
    <main className={styles.page} lang={lang}>
      <header className={styles.header}>
        <Link
          href="/"
          prefetch={false}
          className={styles.brand}
          aria-label="Nuzenio home"
        >
          NUZENIO
        </Link>
        <nav aria-label={t('Preview interface language', 'डेमो इंटरफ़ेस की भाषा')}>
          <a
            href={languageLink('en')}
            lang="en"
            aria-current={lang === 'en' ? 'page' : undefined}
          >
            English
          </a>
          <a
            href={languageLink('hi')}
            lang="hi"
            aria-current={lang === 'hi' ? 'page' : undefined}
          >
            हिंदी
          </a>
        </nav>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>
          {t('SOURCE CARDS / OFFLINE LAB', 'स्रोत कार्ड / ऑफ़लाइन प्रयोग')}
        </p>
        <h1>{t('From the source.', 'सीधे स्रोत से।')}</h1>
        <p className={styles.lead}>
          {t(
            'Original headlines. Clear attribution. A link to read more.',
            'मूल शीर्षक। स्पष्ट श्रेय। पूरा पढ़ने के लिए स्रोत का लिंक।',
          )}
        </p>
        <p>
          {t(
            'A source excerpt is not a verified Nuzenio summary. Official releases and community reporting are labelled separately.',
            'स्रोत का अंश Nuzenio का सत्यापित सारांश नहीं है। आधिकारिक विज्ञप्ति और समुदाय रिपोर्ट की पहचान अलग है।',
          )}
        </p>
      </section>

      <aside
        className={styles.notice}
        aria-label={t('Fictional preview notice', 'काल्पनिक डेमो सूचना')}
      >
        <strong>
          {t(
            'Fictional preview — not live news',
            'काल्पनिक डेमो — लाइव समाचार नहीं',
          )}
        </strong>
        <p>
          {t(
            'All four examples are invented. PIB and Global Voices are disabled research candidates. No feed is connected, and demo links use reserved .example domains.',
            'चारों उदाहरण बनाए गए हैं। PIB और Global Voices शोध हेतु चुने गए निष्क्रिय स्रोत हैं। कोई फ़ीड जुड़ी नहीं है; डेमो लिंक आरक्षित .example डोमेन पर हैं।',
          )}
        </p>
        <p>
          {t(
            'No paid API · No generated summaries · No automatic translation · No images or full articles',
            'कोई सशुल्क API नहीं · AI सारांश नहीं · स्वचालित अनुवाद नहीं · चित्र या पूरे लेख नहीं',
          )}
        </p>
      </aside>

      <div className={styles.layout}>
        <section aria-labelledby="cards-title">
          <div className={styles.sectionHeading}>
            <h2 id="cards-title">{t('Explore the format', 'कार्ड का रूप देखें')}</h2>
            <span>
              {visible.length} {t('fictional cards', 'काल्पनिक कार्ड')}
            </span>
          </div>
          <form
            className={styles.filters}
            action="/preview/source-cards"
            method="get"
          >
            <input type="hidden" name="lang" value={lang} />
            <label>
              {t('Original language', 'मूल भाषा')}
              <select name="original" defaultValue={original}>
                <option value="all">{t('All languages', 'सभी भाषाएँ')}</option>
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
              </select>
            </label>
            <label>
              {t('Format candidate', 'स्रोत का उदाहरण')}
              <select name="source" defaultValue={source}>
                <option value="all">{t('Both candidates', 'दोनों स्रोत')}</option>
                {sourceCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">{t('Apply filters', 'फ़िल्टर लगाएँ')}</button>
          </form>
          <p className={styles.helper}>
            {t(
              'Changing the interface language never translates the original text. Dates below are fixed fixture dates, not freshness claims.',
              'इंटरफ़ेस की भाषा बदलने से मूल पाठ का अनुवाद नहीं होता। नीचे की तारीखें परीक्षण की हैं, ताज़ा खबर का दावा नहीं।',
            )}
          </p>

          <div className={styles.cards}>
            {visible.map((card) => (
              <article
                key={card.id}
                className={styles.card}
                data-fixture-card={card.id}
              >
                <div className={styles.cardTop}>
                  <span className={styles.badge}>
                    {t('Fictional', 'काल्पनिक')}
                  </span>
                  <span>{card.language === 'hi' ? 'हिंदी' : 'English'}</span>
                </div>
                <p className={styles.sourceType}>
                  {card.sourceType === 'official-release'
                    ? t('Official-release format', 'आधिकारिक विज्ञप्ति का प्रारूप')
                    : t('Community-reporting format', 'समुदाय रिपोर्ट का प्रारूप')}
                </p>
                <h3 lang={card.language}>{card.headline}</h3>
                <p className={styles.byline} lang="en">
                  {card.publisher}
                </p>
                <p className={styles.byline} lang={card.language}>
                  {card.author}
                </p>
                <time dateTime={card.publishedAt}>
                  {new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(card.publishedAt))}{' '}
                  IST
                </time>
                <p className={styles.excerpt} lang={card.language}>
                  {card.excerpt}
                </p>
                <div className={styles.attribution}>
                  <strong>{t('Attribution example', 'श्रेय का उदाहरण')}</strong>
                  <p lang={card.language}>{card.attribution}</p>
                  <a
                    href={card.licenceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t(
                      'Demo policy link (not live)',
                      'डेमो नीति लिंक (लाइव नहीं)',
                    )}
                  </a>
                </div>
                <a
                  className={styles.originalLink}
                  href={card.originalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t(
                    'Original link example (not live)',
                    'मूल लिंक का उदाहरण (लाइव नहीं)',
                  )}{' '}
                  <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <output>
              {t(
                'No fictional examples match these filters.',
                'इन फ़िल्टर से कोई काल्पनिक उदाहरण नहीं मिला।',
              )}
            </output>
          )}
        </section>

        <aside className={styles.registry} aria-labelledby="registry-title">
          <p className={styles.eyebrow}>
            {t('RESEARCH, NOT APPROVAL', 'शोध, स्वीकृति नहीं')}
          </p>
          <h2 id="registry-title">
            {t('Two candidates. Both off.', 'दो स्रोत। दोनों बंद।')}
          </h2>
          {sourceCandidates.map((candidate) => (
            <section key={candidate.id} className={styles.candidate}>
              <h3>{candidate.name}</h3>
              <span className={styles.badge}>
                {t('Disabled · not reviewed', 'निष्क्रिय · समीक्षा बाकी')}
              </span>
              <p lang="en">{candidate.reviewNote}</p>
              <a
                href={candidate.policyUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('Published reuse policy', 'प्रकाशित पुनः उपयोग नीति')} ↗
              </a>
              <small>
                {t('Policy research:', 'नीति शोध:')} {candidate.checkedOn}
              </small>
            </section>
          ))}
          <p>
            {t(
              'Next gate: verify an exact feed and item-level permissions, then independently review a private import. No publishing permission is granted here.',
              'अगला चरण: सही फ़ीड और हर लेख के अधिकार जाँचें, फिर निजी आयात की स्वतंत्र समीक्षा करें। यहाँ प्रकाशन की अनुमति नहीं दी गई है।',
            )}
          </p>
        </aside>
      </div>
      <footer className={styles.footer}>
        {t(
          'Development-only preview. Nothing is saved, followed, published or added to your reader history.',
          'केवल विकास हेतु डेमो। कुछ भी सेव, फ़ॉलो, प्रकाशित या आपके रीडर इतिहास में जोड़ा नहीं जाता।',
        )}
      </footer>
    </main>
  );
}
