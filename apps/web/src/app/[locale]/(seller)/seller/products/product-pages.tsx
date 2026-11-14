'use client';

import type { ProductView } from '@balitrade/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { ProductForm } from '@/components/seller/product-form';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch } from '@/lib/api';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslations('Products');
  // The seller shell supplies the page padding; the form keeps its own narrow width. The heading stays
  // because this is a sub-page of Products, which is what the shell's top bar is already called.
  return (
    <div className="w-full max-w-2xl flex-1">
      <Link href="/seller/products" className="text-sm font-semibold text-primary hover:underline">
        ← {t('back')}
      </Link>
      <div className="mt-4 rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-text">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function NotApproved() {
  const t = useTranslations('Products');
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-text">{t('notApproved')}</p>
      <Link href="/seller" className={buttonClasses('primary')}>
        {t('goToSeller')}
      </Link>
    </div>
  );
}

export function NewProduct() {
  const t = useTranslations('Products');
  return (
    <LoginGate allow={(user) => user.roles.includes('SELLER')}>
      {() => (
        <Shell title={t('newTitle')}>
          <ProductForm product={null} />
        </Shell>
      )}
    </LoginGate>
  );
}

export function EditProduct({ id }: { id: string }) {
  return <LoginGate allow={(user) => user.roles.includes('SELLER')}>{() => <EditLoader id={id} />}</LoginGate>;
}

type State = { kind: 'loading' } | { kind: 'forbidden' } | { kind: 'missing' } | { kind: 'ready'; product: ProductView };

function EditLoader({ id }: { id: string }) {
  const t = useTranslations('Products');
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiFetch<ProductView>(`/seller/products/${encodeURIComponent(id)}?locale=${locale}`)
      .then((product) => !cancelled && setState({ kind: 'ready', product }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: error instanceof ApiError && error.status === 403 ? 'forbidden' : 'missing' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale]);

  if (state.kind === 'loading') {
    return <div className="w-full max-w-2xl flex-1" aria-busy="true" />;
  }
  if (state.kind === 'forbidden') {
    return <NotApproved />;
  }
  if (state.kind === 'missing') {
    return (
      <Shell title={t('editTitle')}>
        <p role="alert" className="text-error">
          {t('loadError')}
        </p>
      </Shell>
    );
  }
  return (
    <Shell title={t('editTitle')}>
      <ProductForm product={state.product} />
    </Shell>
  );
}
