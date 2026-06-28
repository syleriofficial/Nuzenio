export function Footer({ copy, localEditions = [], onPrivacySettings, trafficHubs = [] }) {
  const hubGroups = [
    {
      label: 'Essential news',
      slugs: ['latest-news', 'breaking-news', 'local-news', 'world-news', 'politics-news'],
    },
    {
      label: 'Money',
      slugs: ['business-news', 'finance-news', 'market-news', 'startup-news'],
    },
    {
      label: 'Innovation',
      slugs: ['technology-news', 'ai-news', 'science-news', 'space-news', 'climate-news', 'health-news'],
    },
    {
      label: 'Media',
      slugs: ['sports-news', 'entertainment-news', 'live-news', 'video-news'],
    },
  ].map((group) => ({
    ...group,
    pages: group.slugs
      .map((slug) => trafficHubs.find((page) => page.slug === slug))
      .filter(Boolean),
  })).filter((group) => group.pages.length);

  return (
    <footer className="footer">
      <div className="footerBrand">
        <b>Nuzenio</b>
        <span>{copy.tagline}</span>
      </div>
      {hubGroups.map((group) => (
        <nav className="footerLinkGroup" aria-label={`${group.label} hubs`} key={group.label}>
          <strong>{group.label}</strong>
          {group.pages.map((page) => (
            <a key={page.slug} href={`/${page.slug}`}>{page.label}</a>
          ))}
        </nav>
      ))}
      <nav className="footerLinkGroup" aria-label="Popular local editions">
        <strong>Local editions</strong>
        {localEditions.map((edition) => (
          <a key={`footer-${edition.country}-${edition.city}`} href={edition.href}>{edition.label}</a>
        ))}
        <a href="/local">More local news</a>
      </nav>
      <nav className="footerLinkGroup" aria-label="Nuzenio policies">
        <strong>Trust</strong>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/sources">Sources</a>
        <a href="/editorial-policy">Editorial Policy</a>
        <a href="/fact-checking-policy">Fact-Checking Policy</a>
        <a href="/ai-policy">AI Policy</a>
        <a href="/corrections">Corrections</a>
      </nav>
      <nav className="footerLinkGroup" aria-label="Nuzenio business and technical links">
        <strong>Platform</strong>
        <a href="/advertise">Advertise</a>
        <a href="/newsletter">Newsletter</a>
        <a href="/submit-source">Submit Source</a>
        <a href="/publisher-dashboard">Publisher Dashboard</a>
        <a href="/publisher-verify">Publisher Verification</a>
        <a href="/feeds">Feeds</a>
        <a href="/feed.xml">RSS</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/affiliate-disclosure">Affiliate Disclosure</a>
        <a href="/humans.txt">Humans</a>
        <a href="/llms.txt">LLMs</a>
        <button type="button" onClick={onPrivacySettings}>Privacy settings</button>
      </nav>
    </footer>
  );
}
