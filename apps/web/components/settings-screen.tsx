'use client';

import { useState } from 'react';
import { Check, Languages, MapPin, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePreferences } from '@/lib/preferences';
import { useReaderPreferences } from '@/lib/reader-preferences';
import Link from 'next/link';

export function SettingsScreen() {
  const { language, theme, setLanguage, setTheme, t } = usePreferences();
  const reader = useReaderPreferences();
  const [breaking, setBreaking] = useState(false);
  return (
    <main>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {t('Control your edition', 'अपना संस्करण नियंत्रित करें')}
          </p>
          <h1>{t('Settings', 'सेटिंग्स')}</h1>
          <p className="lede">
            {t(
              'Preferences stay on this device in the demonstration build.',
              'प्रदर्शन बिल्ड में प्राथमिकताएं इस डिवाइस पर रहती हैं।',
            )}
          </p>
        </div>
      </section>
      <div className="settings-grid">
        <section className="settings-card">
          <header>
            <Languages />
            <div>
              <h2>{t('Language', 'भाषा')}</h2>
              <p>
                {t(
                  'Switch headlines, briefs and navigation.',
                  'हेडलाइन, ब्रीफ और नेविगेशन बदलें।',
                )}
              </p>
            </div>
          </header>
          <div className="choice-row">
            <Button
              variant={language === 'en' ? 'default' : 'outline'}
              onClick={() => setLanguage('en')}
            >
              {language === 'en' && <Check />} English
            </Button>
            <Button
              variant={language === 'hi' ? 'default' : 'outline'}
              onClick={() => setLanguage('hi')}
            >
              {language === 'hi' && <Check />} हिंदी
            </Button>
          </div>
        </section>
        <section className="settings-card">
          <header>
            {theme === 'dark' ? <Moon /> : <Sun />}
            <div>
              <h2>{t('Appearance', 'दिखावट')}</h2>
              <p>
                {t(
                  'Choose a calm light or dark reading theme.',
                  'शांत लाइट या डार्क रीडिंग थीम चुनें।',
                )}
              </p>
            </div>
          </header>
          <div className="choice-row">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
            >
              <Sun /> {t('Light', 'लाइट')}
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
            >
              <Moon /> {t('Dark', 'डार्क')}
            </Button>
          </div>
        </section>
        <section className="settings-card">
          <header>
            <MapPin />
            <div>
              <h2>{t('Local edition', 'स्थानीय संस्करण')}</h2>
              <p>{t('Delhi NCR pilot', 'दिल्ली NCR पायलट')}</p>
            </div>
          </header>
          <label className="select-label">
            {t('Area', 'क्षेत्र')}
            <select defaultValue="delhi-ncr">
              <option value="delhi-ncr">Delhi NCR</option>
            </select>
          </label>
        </section>
        <section className="settings-card">
          <header>
            <ShieldCheck />
            <div>
              <h2>{t('Personalisation & alerts', 'निजीकरण और अलर्ट')}</h2>
              <p>
                {t(
                  'Transparent controls—never hidden engagement tuning.',
                  'पारदर्शी नियंत्रण—छिपी एंगेजमेंट ट्यूनिंग नहीं।',
                )}
              </p>
            </div>
          </header>
          <div className="switch-row">
            <span>
              <strong id="personalisation-label">
                {t('Personalised For You', 'आपके लिए निजीकरण')}
              </strong>
              <small>
                {t(
                  'Prioritise followed topics and sources. Hidden sources stay excluded even when this is off.',
                  'फॉलो किए विषय और स्रोत पहले दिखाएं। बंद करने पर भी छिपे स्रोत बाहर रहेंगे।',
                )}
              </small>
            </span>
            <Switch
              checked={reader.personalized}
              onCheckedChange={reader.setPersonalized}
              disabled={!reader.ready}
              aria-labelledby="personalisation-label"
            />
          </div>
          <div className="switch-row">
            <span>
              <strong id="alerts-label">
                {t('High-priority alerts', 'उच्च प्राथमिकता अलर्ट')}
              </strong>
              <small>
                {t(
                  'Public-safety and major national updates only.',
                  'केवल जन सुरक्षा और प्रमुख राष्ट्रीय अपडेट।',
                )}
              </small>
            </span>
            <Switch
              checked={breaking}
              onCheckedChange={setBreaking}
              aria-labelledby="alerts-label"
            />
          </div>
        </section>
      </div>
      <section className="settings-card reader-hidden-sources">
        <h2>{t('Hidden sources', 'छिपे स्रोत')}</h2>
        <p>
          {t(
            'Stories containing a hidden source are excluded from feed lists. Direct links and the full evidence remain accessible.',
            'छिपे स्रोत वाली स्टोरी फीड सूची से हटती हैं। सीधे लिंक और पूरे साक्ष्य उपलब्ध रहते हैं।',
          )}
        </p>
        {reader.hidden.length ? (
          <ul>
            {reader.hidden.map((slug) => (
              <li key={slug} className="reader-source-choice">
                <Link href={`/source/${slug}?lang=${language}`}>
                  {slug.replaceAll('-', ' ')}
                </Link>
                <Button
                  variant="outline"
                  onClick={() => reader.toggle('hidden', slug)}
                  aria-label={t(`Unhide ${slug}`, `${slug} फिर दिखाएं`)}
                >
                  {t('Unhide source', 'स्रोत फिर दिखाएं')}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No sources hidden.', 'कोई स्रोत छिपा नहीं है।')}</p>
        )}
        <Link href={`/saved?lang=${language}`}>
          {t('Open saved stories', 'सेव की गई स्टोरी खोलें')}
        </Link>
      </section>
    </main>
  );
}
