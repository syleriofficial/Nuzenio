import { useEffect } from 'react';

export function useDocumentLanguage(language) {
  useEffect(() => {
    document.documentElement.dir = language.dir;
    document.documentElement.lang = language.code;
    document.documentElement.dataset.newsLanguage = language.code;
    try {
      localStorage.setItem('nuzenio_news_language', language.code);
    } catch {
      // Preference persistence is optional; document language should still update.
    }
  }, [language.code, language.dir]);
}
