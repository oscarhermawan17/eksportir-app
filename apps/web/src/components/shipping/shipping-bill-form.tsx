'use client';

import { SHIPPING_LIMITS } from '@balitrade/shared';
import type { IssueShippingBillInput, ShippingBillResponse } from '@balitrade/shared';
import { Plus, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { MediaUploader } from '@/components/media/media-uploader';
import { Button } from '@/components/ui/button';
import { Field, FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import type { UploadedMedia } from '@/lib/media';

type Line = { id: number; label: string; amount: string };
let nextLine = 1;
const emptyLine = (): Line => ({ id: nextLine++, label: '', amount: '' });

/**
 * OPS's shipping bill (T19): cost lines, weight, cartons and an optional photo of the packed cartons. The API adds the
 * lines up and freezes today's exchange rate; the total shown here is only a preview.
 */
export function ShippingBillForm({
  orderId,
  revising,
  onSent,
  onStale,
  onCancel,
}: {
  orderId: string;
  revising: boolean;
  onSent: (bill: ShippingBillResponse) => void;
  onStale: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('Shipping');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
  const [weight, setWeight] = useState('');
  const [cartons, setCartons] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<UploadedMedia | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const amounts = lines.map((line) => Number(line.amount));
  const preview = amounts.every((amount) => Number.isFinite(amount) && amount > 0) ? amounts.reduce((sum, amount) => sum + amount, 0) : null;
  const setLine = (id: number, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems: string[] = [];
    if (lines.some((line) => line.label.trim().length < SHIPPING_LIMITS.labelMin)) problems.push(t('form.errLabel'));
    if (amounts.some((amount) => !(amount >= SHIPPING_LIMITS.lineMinUsd && amount <= SHIPPING_LIMITS.lineMaxUsd))) problems.push(t('form.errAmount'));
    const kg = Number(weight);
    const count = Number(cartons);
    if (!(kg >= SHIPPING_LIMITS.weightMinKg && kg <= SHIPPING_LIMITS.weightMaxKg)) problems.push(t('form.errWeight'));
    if (!(Number.isInteger(count) && count >= SHIPPING_LIMITS.cartonsMin && count <= SHIPPING_LIMITS.cartonsMax)) problems.push(t('form.errCartons'));
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }

    const body: IssueShippingBillInput = {
      lines: lines.map((line) => ({ label: line.label.trim(), amountUsd: Math.round(Number(line.amount) * 100) / 100 })),
      weightKg: Math.round(kg * 100) / 100,
      cartons: count,
      ...(photo ? { photoKey: photo.key } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setBusy(true);
    setErrors([]);
    try {
      const bill = await apiFetch<ShippingBillResponse>(`/admin/orders/${orderId}/shipping-bill`, { method: 'POST', body });
      // The page stays mounted when the admin moves on (AGENTS.md), so the form empties itself.
      setLines([emptyLine()]);
      setWeight('');
      setCartons('');
      setNote('');
      setPhoto(null);
      setUploaderKey((n) => n + 1);
      onSent(bill);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) onStale();
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-background/60 p-4" noValidate>
      <div>
        <h3 className="text-base font-semibold text-text">{revising ? t('form.reviseTitle') : t('form.title')}</h3>
        <p className="mt-1 text-sm text-muted">{t('form.hint')}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-wider text-text">{t('form.linesLabel')}</legend>
        {lines.map((line, index) => (
          <div key={line.id} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-48 text-xs font-semibold text-muted">
              {t('form.lineLabel', { n: index + 1 })}
              <input
                value={line.label}
                onChange={(event) => setLine(line.id, { label: event.target.value })}
                maxLength={SHIPPING_LIMITS.labelMax}
                placeholder={index === 0 ? t('form.linePlaceholder') : undefined}
                className="mt-1 h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="w-32 text-xs font-semibold text-muted">
              {t('form.lineAmount')}
              <input
                value={line.amount}
                onChange={(event) => setLine(line.id, { amount: event.target.value })}
                inputMode="decimal"
                type="number"
                min={SHIPPING_LIMITS.lineMinUsd}
                max={SHIPPING_LIMITS.lineMaxUsd}
                step="0.01"
                className="mt-1 h-10 w-full rounded-button border border-border bg-card px-3 text-right text-sm tabular-nums text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </label>
            {lines.length > 1 ? (
              <button
                type="button"
                onClick={() => setLines((current) => current.filter((other) => other.id !== line.id))}
                aria-label={t('form.removeLine', { n: index + 1 })}
                className="mb-1 rounded-button p-2 text-muted hover:bg-background hover:text-text"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
        {lines.length < SHIPPING_LIMITS.linesMax ? (
          <button type="button" onClick={() => setLines((current) => [...current, emptyLine()])} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('form.addLine')}
          </button>
        ) : null}
        <p className="text-sm text-text">
          {t('form.preview')}{' '}
          <span className="font-bold tabular-nums">{preview === null ? '—' : format.number(preview, { style: 'currency', currency: 'USD' })}</span>
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`ship-weight-${orderId}`}
          label={t('form.weight')}
          type="number"
          inputMode="decimal"
          min={SHIPPING_LIMITS.weightMinKg}
          max={SHIPPING_LIMITS.weightMaxKg}
          step="0.01"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          required
        />
        <Field
          id={`ship-cartons-${orderId}`}
          label={t('form.cartons')}
          type="number"
          inputMode="numeric"
          min={SHIPPING_LIMITS.cartonsMin}
          max={SHIPPING_LIMITS.cartonsMax}
          step="1"
          value={cartons}
          onChange={(event) => setCartons(event.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-text">{t('form.photo')}</p>
        <p className="text-xs text-muted">{t('form.photoHelper')}</p>
        <MediaUploader
          key={uploaderKey}
          purpose="PRIVATE_FILE"
          onUploaded={(item) => {
            if (item.kind === 'IMAGE') setPhoto(item);
          }}
          onRemoved={(item) => setPhoto((current) => (current?.key === item.key ? null : current))}
        />
      </div>

      <TextareaField
        id={`ship-note-${orderId}`}
        label={t('form.note')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={SHIPPING_LIMITS.noteMax}
        rows={2}
      />

      <FormErrors messages={errors} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t('working') : revising ? t('form.submitRevision') : t('form.submit')}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t('back')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
