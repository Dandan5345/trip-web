import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { DIRECTION, LOCALES, strings } from './strings';
import type { Locale, StringKey } from './strings';

interface I18nValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  setLocale: (locale: Locale) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'tripease.locale';

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  } catch {
    // Private windows and blocked storage are fine; Hebrew is the default.
  }
  return 'he';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = DIRECTION[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist.
    }
  }, []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      const template: string = strings[locale][key] ?? strings.he[key] ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        template,
      );
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, dir: DIRECTION[locale], setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
