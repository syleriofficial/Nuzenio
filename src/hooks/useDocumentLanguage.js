import { useEffect } from 'react';

export function useDocumentLanguage(language) {
  useEffect(() => {
    document.documentElement.dir = language.dir;
    document.documentElement.lang = language.code;
    document.documentElement.dataset.newsLanguage = 'en';
    localStorage.removeItem('nuzenio_news_language');
    localStorage.removeItem('newssetu_news_language');
  }, [language.code, language.dir]);
}
