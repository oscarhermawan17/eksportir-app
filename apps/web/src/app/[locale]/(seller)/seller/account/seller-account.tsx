'use client';

import type { QcZoneOption, SellerProfileView } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { SellerForm } from '@/components/seller/seller-form';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError, apiFetch } from '@/lib/api';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; profile: SellerProfileView | null; zones: QcZoneOption[] };

export function SellerAccountPage() {
  return <LoginGate>{(user) => <SellerAccount defaultName={user.name} phone={user.phone} />}</LoginGate>;
}

function SellerAccount({ defaultName, phone }: { defaultName: string; phone: string | null }) {
  const t = useTranslations('Seller');
  const tCommon = useTranslations('Common');
  const tProducts = useTranslations('Products');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const zones = await apiFetch<QcZoneOption[]>('/qc-zones');
        const profile = await apiFetch<SellerProfileView>('/sellers/me').catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            return null; // not a seller yet -> show the application form
          }
          throw error;
        });
        if (!cancelled) {
          setState({ kind: 'ready', profile, zones });
        }
      } catch (error) {
        console.error('Could not load seller account', error);
        if (!cancelled) {
          setState({ kind: 'error' });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.kind === 'loading') {
    return <div className="w-full max-w-2xl flex-1" aria-busy="true" />;
  }
  if (state.kind === 'error') {
    return (
      <div className="flex w-full max-w-2xl flex-1 flex-col items-start gap-4" role="alert">
        <p className="text-error">{t('loadError')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const { profile, zones } = state;
  return (
    <div className="w-full max-w-2xl flex-1">
      <div className="rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/*
            A heading only for an applicant. They have no SELLER role yet, so they see this page in the
            storefront chrome, which has no page title; a seller sees it inside the seller shell, whose
            top bar already names the page.
          */}
          {profile ? null : <h1 className="text-2xl font-bold text-text">{t('applyTitle')}</h1>}
          {profile ? <StatusBadge status={profile.status} label={t(`status.${profile.status}`)} /> : null}
        </div>

        {profile ? <StatusMessage profile={profile} /> : <p className="mt-2 text-sm text-muted">{t('applyIntro')}</p>}

        {profile?.status === 'APPROVED' ? (
          <Link href="/seller/products" className={buttonClasses('primary', 'mt-4')}>
            {tProducts('manage')}
          </Link>
        ) : null}

        <div className="mt-6">
          <SellerForm
            key={profile?.status ?? 'new'}
            zones={zones}
            profile={profile}
            defaultName={defaultName}
            phone={phone}
            onSaved={(saved) => setState({ kind: 'ready', profile: saved, zones })}
          />
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ profile }: { profile: SellerProfileView }) {
  const t = useTranslations('Seller');

  if (profile.status === 'APPROVED') {
    return <p className="mt-3 rounded-card bg-success/10 px-4 py-3 text-sm text-success">{t('approvedText')}</p>;
  }
  if (profile.status === 'REJECTED') {
    return (
      <div className="mt-3 space-y-1 rounded-card bg-error/5 px-4 py-3 text-sm text-text">
        <p className="font-semibold text-error">{t('rejectedText')}</p>
        {profile.rejectionReason ? (
          <p>
            {t('rejectedReason')} {profile.rejectionReason}
          </p>
        ) : null}
        <p className="text-muted">{t('rejectedHint')}</p>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-1 rounded-card bg-warning/10 px-4 py-3 text-sm text-text">
      <p>{t('pendingText')}</p>
      {!profile.qcZone ? <p className="font-semibold">{t('pendingNeedsLocation')}</p> : null}
    </div>
  );
}
