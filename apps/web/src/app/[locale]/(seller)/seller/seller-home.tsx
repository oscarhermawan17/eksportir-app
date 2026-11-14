'use client';

import type { AuthUser, NotificationsResponse, OrderView, ProductView, SellerProfileView } from '@balitrade/shared';
import { EyeOff, Hourglass, MessageSquare, PackageX, Plus, Store, Truck, Undo2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { OrderRow } from '@/components/orders/order-row';
import { Button, buttonClasses } from '@/components/ui/button';
import { ProductStatusBadge } from '@/components/ui/product-status-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { needsAnswer, profileGaps, sellerStats, type ProfileGap } from '@/lib/seller-stats';

/** Rows shown in a panel before "see all" takes over. */
const PANEL_SIZE = 3;

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      profile: SellerProfileView | null;
      products: ProductView[];
      orders: OrderView[];
      unreadMessages: number;
    };

/** A seller's home: the work waiting for them, not the buyer catalog. */
export function SellerHome() {
  return <LoginGate>{(user) => <Dashboard user={user} />}</LoginGate>;
}

function Dashboard({ user }: { user: AuthUser }) {
  const t = useTranslations('Seller');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
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
        // Only an approved seller has products, orders, or anyone writing to them.
        const approved = profile?.status === 'APPROVED';
        const [products, orders, notifications] = approved
          ? await Promise.all([
              // ?locale= so a listing carries its category's label in this language (T26).
              apiFetch<ProductView[]>(`/seller/products?locale=${locale}`),
              apiFetch<OrderView[]>('/orders'),
              apiFetch<NotificationsResponse>('/notifications'),
            ])
          : [[], [], null];
        if (!cancelled) {
          setState({
            kind: 'ready',
            profile,
            products,
            orders,
            unreadMessages: notifications?.unreadByType.CHAT_MESSAGE ?? 0,
          });
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
  }, [attempt, locale]);

  if (state.kind === 'loading') {
    return <Skeleton />;
  }
  if (state.kind === 'error') {
    return (
      <div className="flex flex-1 flex-col items-start gap-4" role="alert">
        <p className="text-error">{t('loadError')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const { profile, products, orders, unreadMessages } = state;

  // Someone who has not applied yet is still a buyer, so they see this page in the storefront chrome,
  // which carries no page title of its own — hence the heading here and nowhere else on this page.
  if (profile === null) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
        <h1 className="text-2xl font-bold text-text">{t('applyTitle')}</h1>
        <div className="mt-6 rounded-card border border-border bg-card p-6 text-sm shadow-sm">
          <p className="text-text">{t('home.notAppliedText')}</p>
          <Link href="/seller/account" className={buttonClasses('primary', 'mt-4')}>
            {t('applyTitle')}
          </Link>
        </div>
      </div>
    );
  }

  const gaps = profileGaps(profile, user.phone);

  if (profile.status !== 'APPROVED') {
    return (
      <div className="flex-1 space-y-6">
        <ShopHeader profile={profile} />
        <div className="rounded-card border border-border bg-card p-6 text-sm shadow-sm">
          <p className="text-text">{profile.status === 'REJECTED' ? t('rejectedText') : t('pendingText')}</p>
          {profile.status === 'REJECTED' && profile.rejectionReason ? (
            <p className="mt-2 text-error">
              {t('rejectedReason')} {profile.rejectionReason}
            </p>
          ) : null}
          <Link href="/seller/account" className={buttonClasses('primary', 'mt-4')}>
            {t('home.accountLink')}
          </Link>
        </div>
        {gaps.length > 0 ? <ProfileGapsCard gaps={gaps} /> : null}
      </div>
    );
  }

  const stats = sellerStats(products, orders, unreadMessages);
  const waiting = orders.filter(needsAnswer);
  // Newest change first: the API returns a seller's listings in its own order, so this is decided here.
  const latest = [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, PANEL_SIZE);

  return (
    <div className="flex-1 space-y-8">
      <ShopHeader profile={profile} />

      {gaps.length > 0 ? <ProfileGapsCard gaps={gaps} /> : null}

      <StatGroup
        title={t('home.actionSection')}
        highlightWhenSet
        tiles={[
          { key: 'toAnswer', value: stats.toAnswer, href: '/seller/orders', icon: Hourglass },
          { key: 'needsFix', value: stats.needsFix, href: '/seller/products', icon: Undo2 },
          { key: 'outOfStock', value: stats.outOfStock, href: '/seller/products', icon: PackageX },
          { key: 'hiddenByCategory', value: stats.hiddenByCategory, href: '/seller/products', icon: EyeOff },
        ]}
      />

      <StatGroup
        title={t('home.shopSection')}
        tiles={[
          { key: 'live', value: stats.live, href: '/seller/products', icon: Store },
          { key: 'inReview', value: stats.inReview, href: '/seller/products', icon: Hourglass },
          { key: 'inProgress', value: stats.inProgress, href: '/seller/orders', icon: Truck },
          { key: 'unreadMessages', value: stats.unreadMessages, href: '/messages', icon: MessageSquare },
        ]}
      />

      <Panel
        title={t('home.answerPanel')}
        link={orders.length > waiting.length ? { href: '/seller/orders', label: t('home.seeAllOrders') } : null}
      >
        {waiting.length === 0 ? (
          <p className="rounded-card border border-border bg-card px-5 py-6 text-sm text-muted">{t('home.answerEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {waiting.slice(0, PANEL_SIZE).map((order) => (
              <li key={order.id}>
                <OrderRow order={order} basePath="/seller/orders" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {products.length === 0 ? (
        <Panel title={t('home.firstProductTitle')}>
          <div className="rounded-card border border-border bg-card p-6">
            <p className="text-sm text-text">{t('home.noProducts')}</p>
            <Link href="/seller/products/new" className={buttonClasses('primary', 'mt-4')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('home.addProduct')}
            </Link>
          </div>
        </Panel>
      ) : (
        <Panel title={t('home.recentProducts')} link={{ href: '/seller/products', label: t('home.manageProducts') }}>
          <ul className="space-y-3">
            {latest.map((product) => (
              <li key={product.id}>
                <ProductRow product={product} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function ShopHeader({ profile }: { profile: SellerProfileView }) {
  const t = useTranslations('Seller');
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* The shell's top bar is the page title, so the shop name is a heading below it, not an h1. */}
          <h2 className="text-2xl font-bold text-text">{profile.displayName}</h2>
          <StatusBadge status={profile.status} label={t(`status.${profile.status}`)} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {profile.qcZone ? profile.qcZone.name : t('home.noLocation')}
          {/* Only an approved shop has a public page; the catalog answers 404 for every other one. */}
          {profile.status === 'APPROVED' ? (
            <>
              {' · '}
              <Link href={`/sellers/${profile.id}`} className="font-semibold text-primary hover:underline">
                {t('home.publicPage')}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      {profile.status === 'APPROVED' ? (
        <Link href="/seller/products/new" className={buttonClasses('primary')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('home.addProduct')}
        </Link>
      ) : null}
    </header>
  );
}

interface Tile {
  /** Key under `Seller.stats`. */
  key: string;
  value: number;
  href: string;
  icon: typeof Store;
}

/**
 * A row of numbers. `highlightWhenSet` marks the ones that mean work for the seller, so one glance says
 * whether anything needs doing. Two columns on a phone, four from `sm` upwards.
 */
function StatGroup({ title, tiles, highlightWhenSet = false }: { title: string; tiles: Tile[]; highlightWhenSet?: boolean }) {
  const t = useTranslations('Seller');
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const needsWork = highlightWhenSet && tile.value > 0;
          return (
            <li key={tile.key}>
              <Link
                href={tile.href}
                className={`flex h-full flex-col gap-1 rounded-card border bg-card p-4 transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary ${
                  needsWork ? 'border-gold' : 'border-border'
                }`}
              >
                <Icon className={`h-4 w-4 ${needsWork ? 'text-gold-text' : 'text-muted'}`} aria-hidden="true" />
                <span className="text-2xl font-bold tabular-nums text-text">{tile.value}</span>
                <span className="text-xs leading-snug text-muted">{t(`stats.${tile.key}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Panel({ title, link, children }: { title: string; link?: { href: string; label: string } | null; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
        {link ? (
          <Link href={link.href} className="text-sm font-semibold text-primary hover:underline">
            {link.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ProductRow({ product }: { product: ProductView }) {
  const t = useTranslations('Products');
  const cover = product.media.find((item) => item.type === 'IMAGE');
  return (
    <Link
      href={`/seller/products/${product.id}/edit`}
      className="flex items-center gap-3 rounded-card border border-border bg-card p-3 shadow-sm transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-button bg-background">
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
          <img src={cover.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{product.title}</span>
      <ProductStatusBadge status={product.status} label={t(`status.${product.status}`)} />
    </Link>
  );
}

function ProfileGapsCard({ gaps }: { gaps: ProfileGap[] }) {
  const t = useTranslations('Seller');
  return (
    <section className="rounded-card border border-gold bg-card p-5 shadow-sm">
      <h3 className="font-semibold text-text">{t('home.profileGapsTitle')}</h3>
      <p className="mt-1 text-sm text-muted">{t('home.profileGapsText')}</p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-text">
        {gaps.map((gap) => (
          <li key={gap}>{t(`gaps.${gap}`)}</li>
        ))}
      </ul>
      <Link href="/seller/account" className={buttonClasses('secondary', 'mt-4')}>
        {t('home.accountLink')}
      </Link>
    </section>
  );
}

/** The shape of the real thing, so the page does not flash empty while the three requests run. */
function Skeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-8" aria-busy="true">
      <div className="h-9 w-64 rounded-button bg-border/60" />
      {[0, 1].map((group) => (
        <div key={group} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <div key={tile} className="h-24 rounded-card border border-border bg-card" />
          ))}
        </div>
      ))}
      <div className="h-24 rounded-card border border-border bg-card" />
    </div>
  );
}
