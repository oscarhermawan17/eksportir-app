'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Field, FormErrors } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { homePathFor } from '@/lib/home-path';
import { authErrorKey } from '@/lib/api';

export function LoginForm() {
  const t = useTranslations('Auth');
  const { login } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setErrors([]);
    try {
      const user = await login(String(form.get('email')), String(form.get('password')));
      // Next.js keeps this page mounted (hidden) after we navigate away, so the fields would still hold
      // the e-mail and the password when the next person opens the login page — after a logout, say.
      formElement.reset();
      // Continue in the language saved on the account.
      router.push(homePathFor(user), { locale: user.locale });
    } catch (error) {
      setErrors([t(`errors.${authErrorKey(error)}`)]);
    } finally {
      // On success too: the hidden page is never unmounted, so a button left on "Logging in…" stays
      // disabled and nobody can log in again without reloading the tab.
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={t('loginTitle')} subtitle={t('loginSubtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormErrors messages={errors} />
        <Field id="email" name="email" label={t('email')} type="email" autoComplete="email" required maxLength={254} />
        <Field
          id="password"
          name="password"
          label={t('password')}
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t('loginSubmitting') : t('loginSubmit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t('registerSubmit')}
        </Link>
      </p>
    </AuthCard>
  );
}
