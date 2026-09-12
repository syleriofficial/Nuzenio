'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'hi';
type Theme = 'light' | 'dark';

interface PreferencesContextValue {
  language: Language;
  theme: Theme;
  hydrated: boolean;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (english: string, hindi: string) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Theme/language can still work for this visit. */
  }
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>('en');
  const [theme, setThemeState] = useState<Theme>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const queryLanguage = new URLSearchParams(window.location.search).get(
      'lang',
    );
    const storedLanguage = readPreference('nuzenio-language');
    const storedTheme = readPreference('nuzenio-theme');
    if (queryLanguage === 'hi' || queryLanguage === 'en') {
      setLanguageState(queryLanguage);
      writePreference('nuzenio-language', queryLanguage);
    } else if (storedLanguage === 'hi') setLanguageState('hi');
    if (
      storedTheme === 'dark' ||
      (!storedTheme && matchMedia('(prefers-color-scheme: dark)').matches)
    )
      setThemeState('dark');
    setHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = language === 'hi' ? 'hi' : 'en';
  }, [language, theme]);

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    writePreference('nuzenio-language', value);
  };
  const setTheme = (value: Theme) => {
    setThemeState(value);
    writePreference('nuzenio-theme', value);
  };
  const value = useMemo(
    () => ({
      language,
      theme,
      hydrated,
      setLanguage,
      setTheme,
      t: (english: string, hindi: string) =>
        language === 'hi' ? hindi : english,
    }),
    [hydrated, language, theme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context)
    throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}
