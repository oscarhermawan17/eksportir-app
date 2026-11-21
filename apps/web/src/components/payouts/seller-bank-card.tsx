'use client';

import { BANK_LIMITS, maskAccount } from '@balitrade/shared';
import type { SellerBankInput, SellerBankView } from '@balitrade/shared';
import { Landmark, Lock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormErrors } from '@/components/ui/field';
import { apiFetch, errorKey } from '@/lib/api';

/**
 * Where BaliTrade pays the seller (T20). Shown masked once saved, so the full number is not left on screen; "Change"
 * opens an empty form rather than a prefilled one for the same reason. Only the seller and BaliTrade's finance team
 * can read it, and every change is recorded.
 */
export function SellerBankCard() {
  const t = useTranslations('SellerBank');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [bank, setBank] = useState<SellerBankView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ bank: SellerBankView | null }>('/sellers/me/bank')
      .then((loaded) => {
        if (cancelled) return;
        setBank(loaded.bank);
        setEditing(loaded.bank === null);
      })
      .catch((error: unknown) => {
        console.error('Could not load the bank details', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: SellerBankInput = {
      bankName: String(form.get('bankName') ?? '').trim(),
      accountNumber: String(form.get('accountNumber') ?? '').replace(/[\s-]/g, ''),
      accountHolder: String(form.get('accountHolder') ?? '').trim(),
    };
    const problems: string[] = [];
    if (input.bankName.length < BANK_LIMITS.bankNameMin) problems.push(t('errBank'));
    if (!BANK_LIMITS.accountNumberPattern.test(input.accountNumber)) problems.push(t('errNumber'));
    if (input.accountHolder.length < BANK_LIMITS.holderMin) problems.push(t('errHolder'));
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setBusy(true);
    setErrors([]);
    try {
      const saved = await apiFetch<{ bank: SellerBankView }>('/sellers/me/bank', { method: 'PUT', body: input });
      setBank(saved.bank);
      setEditing(false);
      // The page stays mounted when the seller moves on (AGENTS.md): a fresh form next time, never the old number.
      setFormKey((n) => n + 1);
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="seller-bank" className="mt-6 rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 id="seller-bank" className="flex items-center gap-2 text-lg font-bold text-text">
        <Landmark className="h-5 w-5 text-primary" aria-hidden="true" />
        {t('title')}
      </h2>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {t('privacy')}
      </p>

      {failed ? (
        <p role="alert" className="mt-4 text-sm text-error">
          {t('loadError')}
        </p>
      ) : bank === undefined ? (
        <div className="mt-4 h-16" aria-busy="true" />
      ) : editing ? (
        <form key={formKey} onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <Field id="bank-name" name="bankName" label={t('bankName')} placeholder="BCA" maxLength={BANK_LIMITS.bankNameMax} required autoComplete="off" />
          <Field
            id="bank-number"
            name="accountNumber"
            label={t('accountNumber')}
            helper={t('accountNumberHelper')}
            inputMode="numeric"
            maxLength={30}
            required
            autoComplete="off"
          />
          <Field id="bank-holder" name="accountHolder" label={t('accountHolder')} helper={t('accountHolderHelper')} maxLength={BANK_LIMITS.holderMax} required autoComplete="off" />
          <FormErrors messages={errors} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? t('saving') : t('save')}
            </Button>
            {bank ? (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                {t('cancel')}
              </Button>
            ) : null}
          </div>
        </form>
      ) : bank ? (
        <div className="mt-4 space-y-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('bankName')}</dt>
              <dd className="mt-0.5 text-text">{bank.bankName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('accountNumber')}</dt>
              <dd className="mt-0.5 font-mono text-text">{maskAccount(bank.accountNumber)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('accountHolder')}</dt>
              <dd className="mt-0.5 text-text">{bank.accountHolder}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted">{t('updated', { date: format.dateTime(new Date(bank.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t('change')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
