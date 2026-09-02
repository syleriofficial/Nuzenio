'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bookmark,
  Building2,
  Compass,
  Home,
  Languages,
  Menu,
  Moon,
  Newspaper,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PreferencesProvider, usePreferences } from '@/lib/preferences';

const nav = [
  { href: '/', en: 'Top', hi: 'मुख्य', icon: Home },
  { href: '/for-you', en: 'For You', hi: 'आपके लिए', icon: Compass },
  { href: '/local', en: 'Local', hi: 'स्थानीय', icon: Building2 },
  { href: '/briefs', en: 'Briefs', hi: 'ब्रीफ', icon: Newspaper },
  { href: '/following', en: 'Following', hi: 'फॉलोइंग', icon: Bookmark },
];

function ShellContent({ children }: { children: React.ReactNode }) {
  const { language, theme, hydrated, setLanguage, setTheme, t } =
    usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('lang') === language) return;
    params.set('lang', language);
    router.replace(`${currentPath}?${params.toString()}`);
  }, [currentPath, hydrated, language, router]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const reportError = () => undefined;
    const registration = context.registerTool(
      {
        name: 'set_nuzenio_preferences',
        title: 'Set Nuzenio preferences',
        description: 'Set the visible Nuzenio language and theme preferences.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['en', 'hi'] },
            theme: { type: 'string', enum: ['light', 'dark'] },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const value = input as { language?: string; theme?: string };
          if (value.language === 'en' || value.language === 'hi')
            setLanguage(value.language);
          if (value.theme === 'light' || value.theme === 'dark')
            setTheme(value.theme);
          return {
            language: value.language ?? language,
            theme: value.theme ?? theme,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(reportError);
    return () => lifecycle.abort();
  }, [language, setLanguage, setTheme, theme]);

  const isCurrent = (href: string) =>
    href === '/' ? currentPath === '/' : currentPath.startsWith(href);
  const localizedHref = (href: string) => `${href}?lang=${language}`;

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="header-inner">
          <Link
            className="brand"
            href={localizedHref('/')}
            aria-label="Nuzenio home"
          >
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            <span>NUZENIO</span>
          </Link>
          <nav
            className="desktop-nav"
            aria-label={t('Primary navigation', 'मुख्य नेविगेशन')}
          >
            {nav.map(({ href, en, hi }) => (
              <Link
                key={href}
                href={localizedHref(href)}
                aria-current={isCurrent(href) ? 'page' : undefined}
              >
                {t(en, hi)}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link
              className={buttonVariants({ variant: 'ghost', size: 'icon-lg' })}
              href={localizedHref('/search')}
              aria-label={t('Search', 'खोजें')}
            >
              <Search />
            </Link>
            <Button
              variant="ghost"
              className="language-button"
              aria-label={
                language === 'en' ? 'Switch to Hindi' : 'Switch to English'
              }
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
            >
              <Languages /> {language === 'en' ? 'हिंदी' : 'EN'}
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={
                theme === 'dark'
                  ? t('Use light theme', 'लाइट थीम')
                  : t('Use dark theme', 'डार्क थीम')
              }
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button
              className="menu-button"
              variant="ghost"
              size="icon-lg"
              aria-label={
                menuOpen
                  ? t('Close menu', 'मेन्यू बंद करें')
                  : t('Open menu', 'मेन्यू खोलें')
              }
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav
            className="mobile-menu"
            aria-label={t('Mobile navigation', 'मोबाइल नेविगेशन')}
          >
            {nav.map(({ href, en, hi, icon: Icon }) => (
              <Link key={href} href={localizedHref(href)}>
                <Icon /> {t(en, hi)}
              </Link>
            ))}
            <Link href={localizedHref('/search')}>
              <Search /> {t('Search', 'खोजें')}
            </Link>
            <Link href={localizedHref('/settings')}>
              <Settings /> {t('Settings', 'सेटिंग्स')}
            </Link>
          </nav>
        )}
      </header>
      <div className="content-shell">{children}</div>
      <nav
        className="bottom-nav"
        aria-label={t('Primary mobile navigation', 'मुख्य मोबाइल नेविगेशन')}
      >
        {nav.map(({ href, en, hi, icon: Icon }) => (
          <Link
            key={href}
            href={localizedHref(href)}
            aria-current={isCurrent(href) ? 'page' : undefined}
          >
            <Icon />
            <span>{t(en, hi)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ShellContent>{children}</ShellContent>
    </PreferencesProvider>
  );
}
