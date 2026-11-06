'use client';

import type { OrderView, ProductView, SellerProfileView } from '@balitrade/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button, buttonClasses } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch } from '@/lib/api';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; profile: SellerProfileView | null; products: ProductView[]; orders: OrderView[] };

/** A seller's home: what needs their attention, not the buyer catalog. */
export function SellerHome() {
  return <LoginGate>{() => <Dashboard />}</LoginGate>;
}

function Dashboard() {
  const t = useTranslations('Seller');
  const tCommon = useTranslations('Common');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await apiFetch<SellerProfileView>('/sellers/me').catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            return null; // has not applied yet
          }
          throw error;
        });
        // Only an approved seller has products, and only they can be asked to answer an order.
        const approved = profile?.status === 'APPROVED';
        const [products, orders] = approved
          ? await Promise.all([apiFetch<ProductView[]>('/seller/products'), apiFetch<OrderView[]>('/orders')])
          : [[], []];
        if (!cancelled) {
          setState({ kind: 'ready', profile, products, orders });
        }
      } catch (error) {
        console.error('Could not load the seller dashboard', error);
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
    return <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12" aria-busy="true" />;
  }
  if (state.kind === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start gap-4 px-4 py-12" role="alert">
        <p className="text-error">{t('loadError')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const { profile, products, orders } = state;

  // "Needs an answer" follows the order rules themselves, so later tasks (QC, shipping) count automatically.
  const toAnswer = orders.filter((order) => order.actions.length > 0).length;
  const live = products.filter((product) => product.status === 'APPROVED').length;
  const inReview = products.filter((product) => product.status === 'PENDING_REVIEW').length;
  const needsWork = products.filter((product) => product.status === 'REJECTED' || product.status === 'DRAFT').length;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">{profile ? profile.displayName : t('home.title')}</h1>
        {profile ? <StatusBadge status={profile.status} label={t(`status.${profile.status}`)} /> : null}
      </div>

      {profile === null ? (
        <Card>
          <p className="text-text">{t('home.notAppliedText')}</p>
          <Link href="/seller/account" className={buttonClasses('primary', 'mt-4')}>
            {t('applyTitle')}
          </Link>
        </Card>
      ) : profile.status !== 'APPROVED' ? (
        <Card>
          <p className="text-text">{profile.status === 'REJECTED' ? t('rejectedText') : t('pendingText')}</p>
          <Link href="/seller/account" className={buttonClasses('secondary', 'mt-4')}>
            {t('home.accountLink')}
          </Link>
        </Card>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat value={toAnswer} label={t('home.toAnswer')} href="/orders" highlight={toAnswer > 0} />
            <Stat value={live} label={t('home.live')} href="/seller/products" />
            <Stat value={inReview + needsWork} label={t('home.waiting')} href="/seller/products" highlight={needsWork > 0} />
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/seller/products/new" className={buttonClasses('primary')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('home.addProduct')}
            </Link>
            <Link href="/seller/products" className={buttonClasses('secondary')}>
              {t('home.allProducts')}
            </Link>
            <Link href="/seller/account" className={buttonClasses('ghost')}>
              {t('home.accountLink')}
            </Link>
          </div>

          {products.length === 0 ? <Card>{t('home.noProducts')}</Card> : null}
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 rounded-card border border-border bg-card p-6 text-sm shadow-sm">{children}</div>;
}

function Stat({ value, label, href, highlight = false }: { value: number; label: string; href: string; highlight?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className={`flex h-full flex-col gap-1 rounded-card border bg-card p-5 transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary ${
          highlight ? 'border-gold' : 'border-border'
        }`}
      >
        <span className="text-3xl font-bold tabular-nums text-text">{value}</span>
        <span className="text-sm text-muted">{label}</span>
      </Link>
    </li>
  );
}
