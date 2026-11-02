'use client';

import { DELIVERY_COUNTRIES, ORDER_LIMITS } from '@balitrade/shared';
import type { CatalogProduct, CreateOrderInput, DeliveryCountry, OrderView } from '@balitrade/shared';
import { X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCatalogText } from '@/components/catalog/catalog-text';
import { Button, buttonClasses } from '@/components/ui/button';
import { Field, FormErrors, SelectField, TextareaField } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

/** USD price string ("10.00") → whole cents, so the subtotal is computed without floating-point drift. */
const toCents = (usd: string): number => Math.round(Number(usd) * 100);

/**
 * Dialog where a buyer requests an order for a product: quantity, note and delivery address. The server checks everything
 * again (MOQ, stock, price, rate), so the numbers shown here are only a preview. Render it only while it is open.
 */
export function OrderDialog({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const t = useTranslations('Orders.dialog');
  const tOrders = useTranslations('Orders');
  const tProducts = useTranslations('Products');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const text = useCatalogText();
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [qty, setQty] = useState(String(product.moq));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [placed, setPlaced] = useState<OrderView | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const unit = tProducts(`units.${product.unit}`);
  const stock = product.type === 'READY_STOCK' ? product.stockQty : null;
  const quantity = Number(qty);
  const validQuantity = Number.isInteger(quantity) && quantity >= product.moq && (stock === null || quantity <= stock);
  const unitCents = product.priceUsd === null ? null : toCents(product.priceUsd);
  const money = (cents: number) => format.number(cents / 100, { style: 'currency', currency: 'USD' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get('note') ?? '').trim();
    const input: CreateOrderInput = {
      productId: product.id,
      qty: quantity,
      ...(note ? { note } : {}),
      delivery: {
        fullName: String(form.get('fullName') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim(),
        country: String(form.get('country')) as DeliveryCountry,
        address: String(form.get('address') ?? '').trim(),
      },
    };
    setSubmitting(true);
    setErrors([]);
    try {
      setPlaced(await apiFetch<OrderView>('/orders', { method: 'POST', body: input }));
    } catch (error) {
      // The API answers 409 only when no exchange rate is set; its text is English, so it is never shown as is.
      setErrors([error instanceof ApiError && error.status === 409 ? t('noRate') : tErrors(errorKey(error))]);
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed backdrop (the dialog element itself) closes the dialog.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      aria-labelledby="order-dialog-title"
      className="m-auto max-h-[92dvh] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-card border border-border bg-card p-0 text-text shadow-xl backdrop:bg-black/40"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="order-dialog-title" className="text-lg font-semibold">
            {placed ? t('sentTitle') : t('title')}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted">{product.title}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('close')}
          className="rounded-button p-2 text-muted hover:bg-background hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {placed ? (
        <div className="space-y-4 px-5 py-6">
          <p className="text-sm text-text">{t('sentText', { code: placed.code })}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/orders/${placed.id}`} className={buttonClasses('primary')}>
              {t('viewOrder')}
            </Link>
            {placed.conversationId ? (
              <Link href={`/messages?c=${placed.conversationId}`} className={buttonClasses('secondary')}>
                {t('openChat')}
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4 px-5 py-5">
          <Field
            id="order-qty"
            name="qty"
            label={t('quantity', { unit })}
            type="number"
            inputMode="numeric"
            min={product.moq}
            max={stock ?? ORDER_LIMITS.qtyMax}
            step={1}
            required
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            helper={[t('minHelper', { moq: format.number(product.moq), unit }), stock !== null ? t('stockHelper', { stock: format.number(stock), unit }) : null].filter(Boolean).join(' · ')}
          />
          <TextareaField id="order-note" name="note" label={t('note')} helper={t('noteHelper')} rows={2} maxLength={ORDER_LIMITS.noteMax} />

          <fieldset className="space-y-4 rounded-card border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-text">{t('deliveryTitle')}</legend>
            <Field id="order-name" name="fullName" label={t('fullName')} helper={t('fullNameHelper')} required minLength={ORDER_LIMITS.nameMin} maxLength={ORDER_LIMITS.nameMax} autoComplete="name" defaultValue={user?.name ?? ''} />
            <Field id="order-phone" name="phone" label={t('phone')} type="tel" required autoComplete="tel" defaultValue={user?.phone ?? ''} pattern={String.raw`\+?[0-9 \(\)\-]{6,20}`} />
            <SelectField
              id="order-country"
              name="country"
              label={t('country')}
              placeholder={t('countryPlaceholder')}
              required
              options={DELIVERY_COUNTRIES.map((code) => ({ value: code, label: tOrders(`countries.${code}`) }))}
            />
            <TextareaField id="order-address" name="address" label={t('address')} helper={t('addressHelper')} required rows={3} minLength={ORDER_LIMITS.addressMin} maxLength={ORDER_LIMITS.addressMax} autoComplete="street-address" />
          </fieldset>

          <div className="space-y-1 rounded-card border border-gold/40 bg-gold/10 p-4 text-sm">
            {unitCents === null ? (
              <p className="text-text">{t('noPrice')}</p>
            ) : (
              <>
                <p className="flex justify-between gap-3 text-text">
                  <span>{t('unitPrice')}</span>
                  <span className="font-semibold tabular-nums">{text.price(product)}</span>
                </p>
                <p className="flex justify-between gap-3 text-text">
                  <span>{t('subtotal')}</span>
                  <span className="font-semibold tabular-nums">{validQuantity ? money(unitCents * quantity) : '—'}</span>
                </p>
              </>
            )}
            <p className="pt-1 text-xs text-muted">{t('summaryNote')}</p>
          </div>

          <FormErrors messages={errors} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting || unitCents === null || !validQuantity}>
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
