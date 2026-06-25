export function Footer({ copy, localEditions = [], onPrivacySettings, trafficHubs = [] }) {
  return (
    <footer className="footer">
      <div className="footerBrand">
        <b>Nuzenio</b>
        <span>{copy.tagline}</span>
      </div>
      <nav className="footerLinkGroup" aria-label="News hubs">
        <strong>News hubs</strong>
        {trafficHubs.map((page) => (
          <a key={page.slug} href={`/${page.slug}`}>{page.label}</a>
        ))}
      </nav>
      <nav className="footerLinkGroup" aria-label="Popular local editions">
        <strong>Local editions</strong>
        {localEditions.map((edition) => (
          <a key={`footer-${edition.country}-${edition.city}`} href={edition.href}>{edition.label}</a>
        ))}
        <a href="/local">More local news</a>
      </nav>
      <nav className="footerLinkGroup" aria-label="Nuzenio policies">
        <strong>Trust</strong>
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
        <a href="/sources.html">Sources</a>
        <a href="/editorial-policy.html">Editorial Policy</a>
        <a href="/fact-checking-policy.html">Fact-Checking Policy</a>
        <a href="/ai-policy.html">AI Policy</a>
        <a href="/corrections.html">Corrections</a>
      </nav>
      <nav className="footerLinkGroup" aria-label="Nuzenio business and technical links">
        <strong>Platform</strong>
        <a href="/advertise.html">Advertise</a>
        <a href="/feeds.html">Feeds</a>
        <a href="/feed.xml">RSS</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="/affiliate-disclosure.html">Affiliate Disclosure</a>
        <a href="/humans.txt">Humans</a>
        <a href="/llms.txt">LLMs</a>
        <button type="button" onClick={onPrivacySettings}>Privacy settings</button>
      </nav>
    </footer>
  );
}
