'use client';

import { useState } from 'react';
import { Check, Languages, MapPin, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePreferences } from '@/lib/preferences';

export function SettingsScreen() {
  const { language, theme, setLanguage, setTheme, t } = usePreferences();
  const [personalization, setPersonalization] = useState(true);
  const [breaking, setBreaking] = useState(false);
  return (
    <>
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
                  'Use followed topics and hidden sources.',
                  'फॉलो किए विषय और छिपे स्रोत इस्तेमाल करें।',
                )}
              </small>
            </span>
            <Switch
              checked={personalization}
              onCheckedChange={setPersonalization}
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
    </>
  );
}
