'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import ptMessages from '@/locales/pt.json';
import enMessages from '@/locales/en.json';

export type AppLocale = 'pt' | 'en';

type Messages = Record<string, string>;

const messages: Record<AppLocale, Messages> = {
  pt: ptMessages as Messages,
  en: enMessages as Messages,
};

type LocaleContextType = {
  locale: AppLocale;
  intlLocale: string;
  setLocale: (locale: AppLocale, persist?: boolean) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  formatDate: (value: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

function isAppLocale(value: string): value is AppLocale {
  return value === 'pt' || value === 'en';
}

function toIntlLocale(locale: AppLocale) {
  return locale === 'pt' ? 'pt-PT' : 'en-US';
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<AppLocale>('pt');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('app_locale') : null;
    if (stored && isAppLocale(stored)) {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem('app_locale', locale);
  }, [locale]);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    api.get<{ language?: string }>(`/user-settings/${user.id}`)
      .then((settings) => {
        if (!active) return;
        if (settings?.language && isAppLocale(settings.language)) {
          setLocaleState(settings.language);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user?.id]);

  const setLocale = useCallback(async (nextLocale: AppLocale, persist = true) => {
    setLocaleState(nextLocale);
    localStorage.setItem('app_locale', nextLocale);

    if (persist && user?.id) {
      try {
        await api.put(`/user-settings/${user.id}`, { language: nextLocale });
      } catch {
        // keep local preference even if backend persistence fails
      }
    }
  }, [user?.id]);

  const t = useCallback((key: string, fallback?: string) => {
    return messages[locale][key] ?? fallback ?? key;
  }, [locale]);

  const formatDate = useCallback((value: string | Date | number, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(new Date(value));
  }, [locale]);

  const formatTime = useCallback((value: string | Date | number, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(toIntlLocale(locale), {
      hour: '2-digit',
      minute: '2-digit',
      ...(options ?? {}),
    }).format(new Date(value));
  }, [locale]);

  const value = useMemo<LocaleContextType>(() => ({
    locale,
    intlLocale: toIntlLocale(locale),
    setLocale,
    t,
    formatDate,
    formatTime,
  }), [formatDate, formatTime, locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
