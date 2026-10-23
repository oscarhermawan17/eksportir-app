'use client';

import type { AuthUser } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/** Renders children only for a logged-in user (optionally with an extra permission check). */
export function LoginGate({
  allow,
  children,
}: {
  allow?: (user: AuthUser) => boolean;
  children: (user: AuthUser) => ReactNode;
}) {
  const t = useTranslations('Gate');
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12" aria-busy="true" />;
  }
  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-text">{t('loginRequired')}</p>
        <Link href="/login" className={buttonClasses('primary')}>
          {t('login')}
        </Link>
      </div>
    );
  }
  if (allow && !allow(user)) {
    return (
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center text-text" role="alert">
        {t('noAccess')}
      </div>
    );
  }
  return <>{children(user)}</>;
}
