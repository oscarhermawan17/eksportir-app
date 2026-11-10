'use client';

import type { OrderView, PaymentInstructions, PaymentMethod, PaymentSummary } from '@balitrade/shared';
import { PAYMENT_LIMITS, PAYMENT_METHODS, canSubmitPayment, paymentCurrency } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { PaymentList } from '@/components/payments/payment-list';
import { PaymentMethodCard } from '@/components/payments/payment-method-card';
import { Button } from '@/components/ui/button';
import { Field, FormErrors, TextareaField } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import { uploadMedia, validateMediaFile } from '@/lib/media';

interface Loaded {
  order: OrderView;
  summary: PaymentSummary;
  instructions: PaymentInstructions;
}

export function PayOrder({ id }: { id: string }) {
  return <LoginGate>{() => <Pay id={id} />}</LoginGate>;
}

function Pay({ id }: { id: string }) {
  const t = useTranslations('Payments');
  const tOrders = useTranslations('Orders');
  const tCommon = useTranslations('Common');
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<'notFound' | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [order, summary, instructions] = await Promise.all([
          apiFetch<OrderView>(`/orders/${encodeURIComponent(id)}`),
          apiFetch<PaymentSummary>(`/orders/${encodeURIComponent(id)}/payments`),
          apiFetch<PaymentInstructions>('/payments/instructions'),
        ]);
        if (!cancelled) {
          setData({ order, summary, instructions });
          setFailed(null);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setFailed('notFound');
        } else {
          console.error('Could not load the payment page', error);
          setFailed('error');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
      <nav className="mb-5 text-sm text-muted">
        <Link href={`/orders/${id}`} className="hover:text-primary hover:underline">
          ← {t('backToOrder')}
        </Link>
      </nav>

      {failed === 'notFound' ? (
        <p role="alert" className="text-text">
          {tOrders('notFound')}
        </p>
      ) : failed === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-error">{tOrders('loadError')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {tCommon('retry')}
          </Button>
        </div>
      ) : data === null ? (
        <p className="text-muted" aria-busy="true">
          {tOrders('loading')}
        </p>
      ) : (
        <Content data={data} onPaid={(summary) => setData({ ...data, summary })} onStale={() => setAttempt((n) => n + 1)} />
      )}
    </div>
  );
}

function Content({ data, onPaid, onStale }: { data: Loaded; onPaid: (summary: PaymentSummary) => void; onStale: () => void }) {
  const t = useTranslations('Payments');
  const format = useFormatter();
  const { order, summary, instructions } = data;
  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });
  const open = canSubmitPayment(order.viewer, order.status);
  // Only methods whose details are configured can be offered; see PaymentsService.instructions().
  const available = PAYMENT_METHODS.filter(
    (method) => (method === 'BANK_IDR' && instructions.bank) || (method === 'USDT' && instructions.usdt) || (method === 'EXCHANGE' && instructions.exchange),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-text">{t('title', { code: order.code })}</h1>
        <p className="text-sm text-text">{t('protectionNote')}</p>
        {instructions.mock ? (
          <p role="alert" className="rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-sm font-semibold text-text">
            {t('mockWarning')}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="pay-amounts" className="rounded-card border border-border bg-card p-5 shadow-sm">
        <h2 id="pay-amounts" className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('amountsTitle')}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Line label={t('due')} value={money(summary.dueUsd)} />
          <Line label={t('verified')} value={money(summary.verifiedUsd)} />
          <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-bold text-text">
            <dt>{t('remaining')}</dt>
            <dd className="tabular-nums">{money(summary.remainingUsd)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          {t('rateUsed', { rate: format.number(Number(order.fxRate), { minimumFractionDigits: 2, maximumFractionDigits: 4 }) })}
        </p>
        <p className="mt-1 text-xs text-muted">{t('partialAllowed')}</p>
      </section>

      {open ? (
        available.length === 0 ? (
          <p role="alert" className="rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-text">
            {t('noMethods')}
          </p>
        ) : (
          <PaymentForm order={order} instructions={instructions} available={available} onPaid={onPaid} onStale={onStale} />
        )
      ) : (
        <p className="rounded-card border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">{t('closedNotice')}</p>
      )}

      <section aria-labelledby="pay-history">
        <h2 id="pay-history" className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
          {t('historyTitle')}
        </h2>
        <PaymentList payments={summary.payments} />
      </section>
    </div>
  );
}

function PaymentForm({
  order,
  instructions,
  available,
  onPaid,
  onStale,
}: {
  order: OrderView;
  instructions: PaymentInstructions;
  available: readonly PaymentMethod[];
  onPaid: (summary: PaymentSummary) => void;
  onStale: () => void;
}) {
  const t = useTranslations('Payments');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [method, setMethod] = useState<PaymentMethod>(available[0]!);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const currency = paymentCurrency(method);
  // The rupiah routes are checked in a rupiah account, so the buyer types rupiah; USDT is typed in USDT.
  const suggested =
    currency === 'USD'
      ? Number(order.totals.totalUsd).toFixed(2)
      : String(Math.round(Number(order.totals.totalUsd) * Number(order.fxRate)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    setDone(false);
    const form = new FormData(event.currentTarget);
    const chosen = file;
    if (!chosen) {
      setErrors([t('proofRequired')]);
      return;
    }
    const problem = validateMediaFile(chosen);
    if (problem) {
      setErrors([t(problem === 'type' ? 'proofType' : 'proofSize')]);
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const uploaded = await uploadMedia(chosen, 'PRIVATE_FILE', setProgress);
      const body: Record<string, unknown> = {
        method,
        amount: Number(form.get('amount')),
        proofKey: uploaded.key,
      };
      for (const field of ['senderName', 'txHash', 'exchangeName', 'reference', 'note'] as const) {
        const value = String(form.get(field) ?? '').trim();
        if (value) body[field] = value;
      }
      const summary = await apiFetch<PaymentSummary>(`/orders/${order.id}/payments`, { method: 'POST', body });
      onPaid(summary);
      setDone(true);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      // 409: the order moved on (someone verified or cancelled it) — reload instead of guessing.
      if (error instanceof ApiError && error.status === 409) onStale();
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <section aria-labelledby="pay-form" className="space-y-5 rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 id="pay-form" className="text-base font-bold text-text">
        {t('formTitle')}
      </h2>

      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-wider text-text">{t('chooseMethod')}</legend>
        <div className="mt-2 space-y-2">
          {available.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer gap-3 rounded-card border p-3 transition ${
                method === option ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <input
                type="radio"
                name="method"
                value={option}
                checked={method === option}
                onChange={() => setMethod(option)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold text-text">{t(`method.${option}`)}</span>
                <span className="block text-xs text-muted">{t(`methodHint.${option}`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-card bg-background p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{t('whereToSend')}</h3>
        <PaymentMethodCard method={method} instructions={instructions} />
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormErrors messages={errors} />
        {done ? (
          <p role="status" className="rounded-card border border-success/40 bg-success/5 px-4 py-3 text-sm font-semibold text-success">
            {t('submitted')}
          </p>
        ) : null}

        <Field
          id="pay-amount"
          name="amount"
          type="number"
          required
          inputMode="decimal"
          step={currency === 'USD' ? '0.01' : '1'}
          min={currency === 'USD' ? PAYMENT_LIMITS.minUsd : PAYMENT_LIMITS.minIdr}
          max={currency === 'USD' ? PAYMENT_LIMITS.maxUsd : PAYMENT_LIMITS.maxIdr}
          defaultValue={suggested}
          key={`amount-${method}`}
          label={t(currency === 'USD' ? 'form.amountUsdt' : 'form.amountIdr')}
          helper={
            currency === 'USD'
              ? t('form.amountUsdtHelper', { total: order.totals.totalUsd })
              : t('form.amountIdrHelper', { total: format.number(Number(suggested)) })
          }
        />

        {method === 'BANK_IDR' ? (
          <Field id="pay-sender" name="senderName" required label={t('form.senderName')} helper={t('form.senderNameHelper')} maxLength={PAYMENT_LIMITS.senderNameMax} />
        ) : null}
        {method === 'USDT' ? (
          <Field id="pay-hash" name="txHash" required label={t('form.txHash')} helper={t('form.txHashHelper')} maxLength={PAYMENT_LIMITS.txHashMax} />
        ) : null}
        {method === 'EXCHANGE' ? (
          <>
            <Field
              id="pay-exchange"
              name="exchangeName"
              required
              label={t('form.exchangeName')}
              helper={t('form.exchangeNameHelper')}
              maxLength={PAYMENT_LIMITS.exchangeNameMax}
            />
            <Field
              id="pay-reference"
              name="reference"
              required
              label={t('form.reference')}
              helper={t('form.referenceHelper')}
              maxLength={PAYMENT_LIMITS.referenceMax}
            />
          </>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="pay-proof" className="block text-xs font-bold uppercase tracking-wider text-text">
            {t('form.proof')}
            <span className="text-error" aria-hidden="true"> *</span>
          </label>
          <input
            ref={fileInput}
            id="pay-proof"
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            aria-describedby="pay-proof-helper"
            className="w-full rounded-card border border-border bg-card px-3.5 py-2.5 text-sm text-text file:mr-3 file:rounded-button file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary"
          />
          <p id="pay-proof-helper" className="text-xs text-muted">
            {t('form.proofHelper')}
          </p>
        </div>

        <TextareaField id="pay-note" name="note" rows={2} label={t('form.note')} helper={t('form.noteHelper')} maxLength={PAYMENT_LIMITS.noteMax} />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? t('sending') : t('submitButton')}
          </Button>
          {progress !== null ? (
            <span className="text-sm text-muted" aria-live="polite">
              {t('uploading', { percent: Math.round(progress * 100) })}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted">{t('form.afterSubmit')}</p>
      </form>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-text">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
