'use client';

import { FX_LIMITS } from '@balitrade/shared';
import type { ExchangeRateInput, ExchangeRateView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { Field, FormErrors } from '@/components/ui/field';
import { apiFetch, errorKey } from '@/lib/api';

/** Up to 4 decimals, same as the API (Decimal(12,4)). */
const RATE_PATTERN = /^\d+(\.\d{1,4})?$/;

export function ExchangeRateAdmin() {
  return <LoginGate allow={(user) => user.roles.includes('ADMIN_OWNER')}>{() => <RatePage />}</LoginGate>;
}

function RatePage() {
  const t = useTranslations('AdminRate');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<ExchangeRateView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const reload = () => {
    setHistory(null);
    setLoadFailed(false);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch<ExchangeRateView[]>('/admin/exchange-rates')
      .then((result) => {
        if (!cancelled) {
          setHistory(result);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load exchange rates', error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const formatRate = (rate: string) => format.number(Number(rate), { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const formatDate = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const current = history?.[0] ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const text = value.trim().replace(',', '.');
    const rate = Number(text);
    if (!RATE_PATTERN.test(text) || rate < FX_LIMITS.min || rate > FX_LIMITS.max) {
      setErrors([t('invalid', { min: format.number(FX_LIMITS.min), max: format.number(FX_LIMITS.max) })]);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const input: ExchangeRateInput = { rate };
      const created = await apiFetch<ExchangeRateView>('/admin/exchange-rates', { method: 'POST', body: input });
      setHistory((rows) => [created, ...(rows ?? [])]);
      setValue('');
      setSaved(true);
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-bold text-text">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('intro')}</p>

      {loadFailed ? (
        <div role="alert" className="mt-6 flex flex-col items-start gap-3">
          <p className="text-error">{t('loadError')}</p>
          <Button variant="secondary" onClick={reload}>
            {tCommon('retry')}
          </Button>
        </div>
      ) : history === null ? (
        <p className="mt-6 text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <section aria-labelledby="current-rate" className="rounded-card border border-border bg-card p-5 shadow-sm">
            <h2 id="current-rate" className="text-xs font-bold uppercase tracking-wider text-muted">
              {t('currentTitle')}
            </h2>
            {current ? (
              <>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text">
                  {t('currentValue', { rate: formatRate(current.rate) })}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t('setOn', { date: formatDate(current.createdAt), name: current.setBy.name })}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-text">{t('notSet')}</p>
            )}
          </section>

          <section aria-labelledby="new-rate" className="rounded-card border border-border bg-card p-5 shadow-sm">
            <h2 id="new-rate" className="text-lg font-semibold text-text">
              {t('formTitle')}
            </h2>
            <form onSubmit={(event) => void onSubmit(event)} className="mt-4 space-y-4" noValidate>
              <Field
                id="rate"
                name="rate"
                label={t('rateLabel')}
                helper={t('rateHelper', { min: format.number(FX_LIMITS.min), max: format.number(FX_LIMITS.max) })}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
              <FormErrors messages={errors} />
              {saved ? (
                <p role="status" className="text-sm font-medium text-success">
                  {t('saved')}
                </p>
              ) : null}
              <Button type="submit" disabled={busy}>
                {t('save')}
              </Button>
            </form>
          </section>

          <section aria-labelledby="rate-history">
            <h2 id="rate-history" className="text-lg font-semibold text-text">
              {t('historyTitle')}
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 rounded-card border border-border bg-card px-5 py-6 text-center text-muted">{t('historyEmpty')}</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-card border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-bold">
                        {t('colRate')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        {t('colSetBy')}
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold">
                        {t('colDate')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-semibold tabular-nums text-text">{formatRate(row.rate)}</td>
                        <td className="px-4 py-3 text-text">{row.setBy.name}</td>
                        <td className="px-4 py-3 text-muted">{formatDate(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
