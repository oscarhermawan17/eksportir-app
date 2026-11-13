'use client';

import type { SelfRegisterRole } from '@balitrade/shared';
import type { Locale } from '@balitrade/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Field, FormErrors } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { authErrorKey } from '@/lib/api';

const ACCOUNT_TYPES: {
  value: SelfRegisterRole;
  titleKey: 'buyer' | 'seller';
  descriptionKey: 'buyerDescription' | 'sellerDescription';
}[] = [
  { value: 'BUYER', titleKey: 'buyer', descriptionKey: 'buyerDescription' },
  { value: 'SELLER', titleKey: 'seller', descriptionKey: 'sellerDescription' },
];

export function RegisterForm() {
  const t = useTranslations('Auth');
  const locale = useLocale() as Locale;
  const { register } = useAuth();
  const router = useRouter();
  const initialRole: SelfRegisterRole = useSearchParams().get('role') === 'seller' ? 'SELLER' : 'BUYER';
  const [role, setRole] = useState<SelfRegisterRole>(initialRole);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const phone = String(form.get('phone') ?? '').trim();
    setSubmitting(true);
    setErrors([]);
    try {
      await register({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        ...(phone ? { phone } : {}),
        role,
        locale,
        acceptAdminInChat: form.get('consent') === 'on',
      });
      // Same reason as on the login page: this page stays mounted (hidden) once we navigate away, so the
      // name, e-mail and password would still be in the fields when the page is opened again.
      formElement.reset();
      setRole(initialRole);
      router.push(role === 'SELLER' ? '/seller' : '/');
    } catch (error) {
      setErrors([t(`errors.${authErrorKey(error)}`)]);
    } finally {
      // On success too, or the button stays disabled on "Creating account…" for whoever opens it next.
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={t('registerTitle')} subtitle={t('registerSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormErrors messages={errors} />

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text">{t('accountType')}</legend>
          {ACCOUNT_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition ${
                role === type.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={type.value}
                checked={role === type.value}
                onChange={() => setRole(type.value)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold text-text">{t(type.titleKey)}</span>
                <span className="block text-xs text-muted">{t(type.descriptionKey)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <Field id="name" name="name" label={t('name')} autoComplete="name" required minLength={2} maxLength={100} />
        <Field id="email" name="email" label={t('email')} type="email" autoComplete="email" required maxLength={254} />
        <Field
          id="password"
          name="password"
          label={t('password')}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          helper={t('passwordHint')}
        />
        <Field
          id="phone"
          name="phone"
          label={t('phoneOptional')}
          type="tel"
          autoComplete="tel"
          pattern={String.raw`\+?[0-9 \(\)\-]{6,20}`}
          title={t('phoneHint')}
        />

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-text">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
          <span>
            {t('adminInChats')}
          </span>
        </label>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t('registerSubmitting') : t('registerSubmit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('loginSubmit')}
        </Link>
      </p>
    </AuthCard>
  );
}
