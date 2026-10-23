'use client';

import { LOCALES, type Locale } from '@balitrade/shared';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

const LABELS: Record<Locale, string> = { en: 'English', id: 'Bahasa Indonesia', ru: 'Русский' };

/**
 * Switches the URL locale (next-intl also stores it in the NEXT_LOCALE cookie) and,
 * when logged in, saves it to the user's profile so it follows them to other devices.
 */
export function LanguageSwitcher({ onDark = false, openUp = false }: { onDark?: boolean; openUp?: boolean }) {
  const t = useTranslations('Common');
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(locale: Locale) {
    setOpen(false);
    if (locale === current) {
      return;
    }
    router.replace(pathname + window.location.search, { locale });
    if (user) {
      apiFetch('/auth/me', { method: 'PATCH', body: { locale } }).catch((error: unknown) => {
        console.error('Could not save language', error);
      });
    }
  }

  const buttonTone = onDark
    ? 'border-white/30 bg-white/10 text-white hover:border-gold'
    : 'border-border bg-card text-text hover:border-primary';

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language')}: ${LABELS[current]}`}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 items-center gap-2 rounded-button border px-3 text-xs font-semibold transition ${buttonTone}`}
      >
        <Globe className={`h-3.5 w-3.5 ${onDark ? 'text-gold' : 'text-gold-text'}`} aria-hidden="true" />
        <span className={`font-bold ${onDark ? 'text-white' : 'text-primary'}`}>{current.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t('language')}
          className={`absolute right-0 z-50 min-w-44 overflow-hidden rounded-card border border-border bg-card py-1 text-sm text-text shadow-lg ${
            openUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {LOCALES.map((locale) => (
            <li key={locale} role="option" aria-selected={locale === current}>
              <button
                type="button"
                lang={locale}
                onClick={() => choose(locale)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-background"
              >
                {LABELS[locale]}
                {locale === current ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
