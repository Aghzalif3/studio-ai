'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Lang = 'fr' | 'en';
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (fr: string, en: string) => string; L: <T>(o: { fr: T; en: T }) => T };
const I18n = createContext<Ctx>({ lang: 'fr', setLang: () => {}, t: (fr) => fr, L: (o) => o.fr });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  useEffect(() => {
    try { const l = localStorage.getItem('studio-lang'); if (l === 'fr' || l === 'en') setLangState(l); } catch {}
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('studio-lang', l); } catch {}
    fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ language: l }) }).catch(() => {});
  }, []);
  const t = useCallback((fr: string, en: string) => (lang === 'fr' ? fr : en), [lang]);
  const L = useCallback(<T,>(o: { fr: T; en: T }) => o[lang], [lang]);
  return <I18n.Provider value={{ lang, setLang, t, L }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
