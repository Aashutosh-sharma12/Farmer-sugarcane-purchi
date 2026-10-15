import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, setItem } from '../storage';
import { translations } from '../i18n';

const LangContext = createContext(null);
const LANG_KEY = 'purchi_lang';

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('hi');

  useEffect(() => {
    getItem(LANG_KEY)
      .then((saved) => saved && translations[saved] && setLangState(saved))
      .catch(() => {});
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    setItem(LANG_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const t = (key, vars = {}) =>
      Object.entries(vars).reduce(
        (text, [k, v]) => text.replace(`{${k}}`, v),
        translations[lang][key] ?? translations.en[key] ?? key
      );
    // Picks the Hindi or English text of items like { en, hi }.
    const L = (item) => item[lang] ?? item.en;
    return { lang, setLang, t, L };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
