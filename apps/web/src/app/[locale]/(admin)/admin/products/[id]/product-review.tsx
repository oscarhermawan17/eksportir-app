'use client';

import {
  TRANSLATION_LOCALES,
  type AdminProductView,
  type ProductTranslationsInput,
  type TranslationLocale,
} from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { Field, FormErrors, TextareaField } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

export function ProductReview({ id }: { id: string }) {
  return (
    <LoginGate allow={(user) => user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_OWNER')}>
      {() => <Loader id={id} />}
    </LoginGate>
  );
}

function Loader({ id }: { id: string }) {
  const tErrors = useTranslations('Errors');
  const [product, setProduct] = useState<AdminProductView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminProductView>(`/admin/products/${encodeURIComponent(id)}`)
      .then((result) => !cancelled && setProduct(result))
      .catch((e: unknown) => !cancelled && setError(tErrors(errorKey(e))));
    return () => {
      cancelled = true;
    };
  }, [id, tErrors]);

  if (error) {
    return (
      <p role="alert" className="text-error">
        {error}
      </p>
    );
  }
  if (!product) {
    return <div className="h-24" aria-busy="true" />;
  }
  return <Review product={product} onChange={setProduct} />;
}

function Review({ product, onChange }: { product: AdminProductView; onChange: (product: AdminProductView) => void }) {
  const t = useTranslations('AdminProducts');
  const tProducts = useTranslations('Products');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const editable = product.status === 'PENDING_REVIEW' || product.status === 'APPROVED';
  const reviewable = product.status === 'PENDING_REVIEW';

  /** Reads the three translation boxes; languages with both fields empty are skipped. */
  function readTranslations(form: HTMLFormElement): ProductTranslationsInput | 'incomplete' {
    const data = new FormData(form);
    const result: ProductTranslationsInput = {};
    for (const locale of TRANSLATION_LOCALES) {
      const title = String(data.get(`${locale}.title`) ?? '').trim();
      const description = String(data.get(`${locale}.description`) ?? '').trim();
      if (title && description) {
        result[locale] = { title, description };
      } else if (title || description) {
        return 'incomplete';
      }
    }
    return result;
  }

  async function saveTranslations(form: HTMLFormElement): Promise<boolean> {
    const input = readTranslations(form);
    if (input === 'incomplete') {
      setErrors([tErrors('invalidInput')]);
      return false;
    }
    if (Object.keys(input).length === 0) {
      return true;
    }
    onChange(await apiFetch<AdminProductView>(`/admin/products/${product.id}/translations`, { method: 'PUT', body: input }));
    return true;
  }

  async function run(action: (form: HTMLFormElement) => Promise<void>, form: HTMLFormElement) {
    setBusy(true);
    setErrors([]);
    setNotice(null);
    try {
      await action(form);
    } catch (error) {
      setErrors([describe(error)]);
    } finally {
      setBusy(false);
    }
  }

  function describe(error: unknown): string {
    // 400 from "approve" means a translation is still missing.
    return error instanceof ApiError && error.status === 400 ? t('needTranslations') : tErrors(errorKey(error));
  }

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async (form) => {
      if (await saveTranslations(form)) setNotice(t('saved'));
    }, event.currentTarget);
  };

  const onApprove = (form: HTMLFormElement) =>
    run(async (f) => {
      if (!(await saveTranslations(f))) return;
      await apiFetch<AdminProductView>(`/admin/products/${product.id}/approve`, { method: 'POST' });
      router.push('/admin/products');
    }, form);

  const onReject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    void run(async () => {
      await apiFetch<AdminProductView>(`/admin/products/${product.id}/reject`, { method: 'POST', body: { reason } });
      router.push('/admin/products');
    }, event.currentTarget);
  };

  return (
    <div>
      <Link href="/admin/products" className="text-sm font-semibold text-primary hover:underline">
        ← {t('back')}
      </Link>

      <section className="mt-4 rounded-card border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-text">{product.translations[product.sourceLocale]?.title}</h1>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted">
            {tProducts(`status.${product.status}`)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {t('seller')}: {product.seller.displayName} ({product.seller.email}) · {t('sellerLanguage')}{' '}
          {t(`locales.${product.sourceLocale}`)}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <Info label={t('category')} value={product.categoryName} />
          <Info label={tProducts(`types.${product.type}`)} value={`${tProducts('moqLabel')} ${product.moq}`} />
          <Info label={t('price')} value={`${format.number(product.priceIdr)} / ${tProducts(`units.${product.unit}`)}`} />
          {product.stockQty !== null ? <Info label={t('stock')} value={String(product.stockQty)} /> : null}
          {product.leadTimeDays !== null ? (
            <Info label={t('leadTime')} value={`${product.leadTimeDays} ${t('days')}`} />
          ) : null}
        </dl>
        {product.media.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {product.media.map((item) => (
              <li key={item.key} className="h-24 w-24 overflow-hidden rounded-button bg-background">
                {item.url && item.type === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote R2 image, sized by CSS
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                ) : item.url ? (
                  <video src={item.url} className="h-full w-full object-cover" controls preload="metadata" />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {product.status === 'REJECTED' && product.rejectionReason ? (
          <p className="mt-4 text-sm text-error">
            {t('rejectedWithReason')} {product.rejectionReason}
          </p>
        ) : null}
      </section>

      <form onSubmit={onSave} className="mt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text">{t('translationsTitle')}</h2>
          <p className="text-sm text-muted">{t('translationsHelp')}</p>
        </div>

        {TRANSLATION_LOCALES.map((locale) => (
          <TranslationBox key={locale} locale={locale} product={product} disabled={!editable || busy} />
        ))}

        <FormErrors messages={errors} />
        {notice ? (
          <p role="status" className="text-sm font-medium text-success">
            {notice}
          </p>
        ) : null}
        {!reviewable ? <p className="text-sm text-muted">{t('readOnly')}</p> : null}

        {!rejecting ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {editable ? (
              <Button type="submit" variant="secondary" disabled={busy}>
                {busy ? t('saving') : t('saveTranslations')}
              </Button>
            ) : null}
            {reviewable ? (
              <>
                <Button disabled={busy} onClick={(event) => event.currentTarget.form && void onApprove(event.currentTarget.form)}>
                  {t('approve')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setRejecting(true)}>
                  {t('reject')}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </form>

      {rejecting ? (
        <form onSubmit={onReject} className="mt-4 space-y-3 rounded-card border border-border bg-card p-5">
          <TextareaField
            id="reason"
            name="reason"
            label={t('reasonLabel')}
            helper={t('reasonHelper')}
            required
            minLength={3}
            maxLength={500}
            rows={3}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {t('confirmReject')}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-text">{value}</dd>
    </div>
  );
}

function TranslationBox({
  locale,
  product,
  disabled,
}: {
  locale: TranslationLocale;
  product: AdminProductView;
  disabled: boolean;
}) {
  const t = useTranslations('AdminProducts');
  const current = product.translations[locale];
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-card border border-border bg-card p-5">
      <legend className="px-1 text-sm font-bold text-text">
        {t(`locales.${locale}`)}
        {locale === product.sourceLocale ? (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {t('fromSeller')}
          </span>
        ) : null}
      </legend>
      <Field
        id={`${locale}-title`}
        name={`${locale}.title`}
        label={t('title_')}
        maxLength={120}
        defaultValue={current?.title ?? ''}
        lang={locale}
      />
      <TextareaField
        id={`${locale}-description`}
        name={`${locale}.description`}
        label={t('description')}
        rows={4}
        maxLength={5000}
        defaultValue={current?.description ?? ''}
        lang={locale}
      />
    </fieldset>
  );
}
