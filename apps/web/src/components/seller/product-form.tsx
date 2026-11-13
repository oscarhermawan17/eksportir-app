'use client';

import {
  PRODUCT_LIMITS,
  PRODUCT_UNITS,
  type ProductCategoryView,
  type ProductInput,
  type ProductType,
  type ProductView,
  type SourceLocale,
} from '@balitrade/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MediaUploader } from '@/components/media/media-uploader';
import { Button } from '@/components/ui/button';
import { Field, FormErrors, SelectField, TextareaField } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import { fetchCategories } from '@/lib/categories';
import type { UploadedMedia } from '@/lib/media';

/** Create (product = null) or edit a listing. "Save" keeps it as is; "Submit" also sends it for review. */
export function ProductForm({ product }: { product: ProductView | null }) {
  const t = useTranslations('Products');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const [type, setType] = useState<ProductType>(product?.type ?? 'READY_STOCK');
  const [sourceLocale, setSourceLocale] = useState<SourceLocale>(product?.sourceLocale ?? 'en');
  // Keys of uploaded files in display order; the uploader reports additions and removals.
  const mediaKeys = useRef<string[]>(product?.media.map((item) => item.key) ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Bumped to remount the uploader, which keeps its own list of files.
  const [mediaVersion, setMediaVersion] = useState(0);

  // Categories come from the API (T26), so a category the owner adds appears here without a deploy and
  // one they switched off is simply not offered.
  const [categories, setCategories] = useState<ProductCategoryView[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchCategories(locale)
      .then((rows) => !cancelled && setCategories(rows))
      .catch((error: unknown) => {
        console.error('Could not load categories', error);
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  /**
   * An admin switched this listing's category off after it was created. The API refuses to save it
   * again under that category, so the seller has to pick another one — say so instead of letting them
   * press Save and read a validation error.
   */
  const categoryWithdrawn = product !== null && !product.categoryActive;

  const initialMedia: UploadedMedia[] =
    product?.media.map((item) => ({ key: item.key, kind: item.type, publicUrl: item.url })) ?? [];

  async function save(formElement: HTMLFormElement, submitAfter: boolean) {
    const form = new FormData(formElement);
    const number = (name: string) => Number(form.get(name));
    const body: ProductInput = {
      type,
      category: String(form.get('category')) as ProductInput['category'],
      unit: String(form.get('unit')) as ProductInput['unit'],
      priceIdr: number('priceIdr'),
      moq: number('moq'),
      ...(type === 'READY_STOCK' ? { stockQty: number('stockQty') } : { leadTimeDays: number('leadTimeDays') }),
      sourceLocale,
      title: String(form.get('title')),
      description: String(form.get('description')),
      media: mediaKeys.current.map((key) => ({ key })),
    };

    if (submitAfter && !mediaKeys.current.some((key) => /\.(jpg|png|webp)$/.test(key))) {
      setErrors([t('form.needPhoto')]);
      return;
    }

    setBusy(true);
    setErrors([]);
    try {
      const saved = product
        ? await apiFetch<ProductView>(`/seller/products/${product.id}`, { method: 'PUT', body })
        : await apiFetch<ProductView>('/seller/products', { method: 'POST', body });
      if (submitAfter) {
        await apiFetch<ProductView>(`/seller/products/${saved.id}/submit`, { method: 'POST' });
      }
      // The listing exists now, so nothing of it may stay in the form. Next.js keeps the page we are
      // leaving mounted (hidden) so that coming back is instant, which means this is the very same form
      // the seller meets when they add their next product: without emptying it they would find the
      // previous product's text, and its photos would still be attached — and a photo belongs to one
      // listing only, so saving again would fail. Only the create form is emptied; the edit form keeps
      // what was just saved, which is what that page is supposed to show.
      if (!product) {
        formElement.reset();
        setType('READY_STOCK');
        setSourceLocale('en');
        mediaKeys.current = [];
        setMediaVersion((version) => version + 1);
      }
      router.push('/seller/products');
    } catch (error) {
      setErrors([error instanceof ApiError && error.status === 400 ? tErrors('invalidInput') : tErrors(errorKey(error))]);
    } finally {
      // On success too: the page stays mounted while hidden, so a button left reading "Saving…" would
      // still be disabled when the seller returns to it.
      setBusy(false);
    }
  }

  const isLive = product?.status === 'APPROVED';
  const canSubmit = !product || product.status === 'DRAFT' || product.status === 'REJECTED';

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void save(event.currentTarget, false);
      }}
      className="space-y-5"
    >
      <FormErrors messages={errors} />
      {isLive ? <p className="rounded-card bg-warning/10 px-4 py-3 text-sm text-text">{t('editWarning')}</p> : null}

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text">{t('form.type')}</legend>
        {(['READY_STOCK', 'MADE_TO_ORDER'] as const).map((value) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center gap-3 rounded-card border p-3 text-sm font-semibold transition ${
              type === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="type"
              value={value}
              checked={type === value}
              onChange={() => setType(value)}
              className="h-4 w-4 accent-primary"
            />
            {t(`types.${value}`)}
          </label>
        ))}
      </fieldset>

      <Field
        id="title"
        name="title"
        label={t('form.title')}
        required
        minLength={PRODUCT_LIMITS.titleMin}
        maxLength={PRODUCT_LIMITS.titleMax}
        defaultValue={product?.title ?? ''}
      />
      <TextareaField
        id="description"
        name="description"
        label={t('form.description')}
        helper={t('form.descriptionHelper')}
        required
        rows={6}
        maxLength={PRODUCT_LIMITS.descriptionMax}
        defaultValue={product?.description ?? ''}
      />

      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text">{t('form.sourceLocale')}</legend>
        {(['en', 'id'] as const).map((value) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name="sourceLocale"
              value={value}
              checked={sourceLocale === value}
              onChange={() => setSourceLocale(value)}
              className="h-4 w-4 accent-primary"
            />
            {value === 'en' ? t('form.localeEn') : t('form.localeId')}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SelectField
            // Remounted when the options arrive so defaultValue is applied to a populated list.
            key={categories === null ? 'category-loading' : 'category-ready'}
            id="category"
            name="category"
            label={t('form.category')}
            placeholder={t('form.categoryPlaceholder')}
            required
            disabled={categories === null}
            options={(categories ?? []).map(({ slug, name }) => ({ value: slug, label: name }))}
            defaultValue={categoryWithdrawn ? '' : (product?.category ?? '')}
          />
          {categoryWithdrawn ? (
            <p role="alert" className="mt-1.5 text-sm text-warning">
              {t('form.categoryWithdrawn', { category: product.categoryName })}
            </p>
          ) : null}
        </div>
        <SelectField
          id="unit"
          name="unit"
          label={t('form.unit')}
          placeholder={t('form.unitPlaceholder')}
          required
          options={PRODUCT_UNITS.map((value) => ({ value, label: t(`units.${value}`) }))}
          defaultValue={product?.unit ?? ''}
        />
        <Field
          id="priceIdr"
          name="priceIdr"
          label={t('form.price')}
          helper={t('form.priceHelper')}
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={PRODUCT_LIMITS.priceIdrMax}
          step={1}
          defaultValue={product?.priceIdr ?? ''}
        />
        <Field
          id="moq"
          name="moq"
          label={t('form.moq')}
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={PRODUCT_LIMITS.moqMax}
          step={1}
          defaultValue={product?.moq ?? 1}
        />
        {type === 'READY_STOCK' ? (
          <Field
            key="stockQty"
            id="stockQty"
            name="stockQty"
            label={t('form.stock')}
            type="number"
            inputMode="numeric"
            required
            min={0}
            max={PRODUCT_LIMITS.stockMax}
            step={1}
            defaultValue={product?.stockQty ?? ''}
          />
        ) : (
          <Field
            key="leadTimeDays"
            id="leadTimeDays"
            name="leadTimeDays"
            label={t('form.leadTime')}
            helper={t('form.leadTimeHelper')}
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={PRODUCT_LIMITS.leadTimeDaysMax}
            step={1}
            defaultValue={product?.leadTimeDays ?? ''}
          />
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text">{t('form.media')}</h2>
        <p className="text-xs text-muted">{t('form.mediaHelper')}</p>
        <MediaUploader
          key={mediaVersion}
          purpose="PRODUCT_MEDIA"
          initialMedia={initialMedia}
          onUploaded={(media) => mediaKeys.current.push(media.key)}
          onRemoved={(media) => {
            mediaKeys.current = mediaKeys.current.filter((key) => key !== media.key);
          }}
        />
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit" variant={canSubmit ? 'secondary' : 'primary'} disabled={busy}>
          {busy ? t('form.saving') : canSubmit ? t('form.saveDraft') : t('form.save')}
        </Button>
        {canSubmit ? (
          <Button
            disabled={busy}
            onClick={(event) => {
              const formElement = event.currentTarget.form;
              if (formElement?.reportValidity()) {
                void save(formElement, true);
              }
            }}
          >
            {busy ? t('form.submitting') : t('form.submit')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
