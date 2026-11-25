'use client';

import {
  BANK_LIMITS,
  USDT_NETWORKS,
  isUsdtAddressFor,
  type AdminPaymentSettingsView,
  type PaymentSettingsInput,
  type UsdtNetwork,
} from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { FormErrors, inputClasses } from '@/components/ui/field';
import { apiFetch, errorKey } from '@/lib/api';

const allowed = (user: { roles: readonly string[] }) => user.roles.some((role) => role === 'ADMIN_FINANCE' || role === 'ADMIN_OWNER');
/** What the API keeps of an account number: digits only. */
const digitsOf = (value: string) => value.replace(/[\s-]/g, '');

export function PaymentSettingsAdmin() {
  return <LoginGate allow={allowed}>{() => <Settings />}</LoginGate>;
}

/**
 * Where buyers send their money (2026-11-26): the bank account and the USDT (Binance) deposit address. FINANCE reads
 * them to match statements; only the OWNER saves. The number and the address are typed twice and checked here and in
 * the API — one wrong character sends a buyer's money elsewhere. The exchange method is not here: it stays in env.
 */
function Settings() {
  const t = useTranslations('PaymentSettings');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const { user } = useAuth();
  const canEdit = !!user?.roles.includes('ADMIN_OWNER');

  const [view, setView] = useState<AdminPaymentSettingsView | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  // The network decides which address shape is valid, so it is controlled; everything else is a plain form field.
  const [network, setNetwork] = useState<UsdtNetwork>('TRC20');

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminPaymentSettingsView>('/admin/payment-settings')
      .then((next) => {
        if (cancelled) return;
        setView(next);
        setNetwork(next.usdtNetwork);
        setFailed(false);
      })
      .catch((error: unknown) => {
        console.error('Could not load the payment settings', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const body: PaymentSettingsInput = {
      bankEnabled: form.get('bankEnabled') === 'on',
      bankName: text('bankName'),
      bankAccountNumber: digitsOf(text('bankAccountNumber')),
      bankAccountNumberConfirm: digitsOf(text('bankAccountNumberConfirm')),
      bankAccountHolder: text('bankAccountHolder'),
      usdtEnabled: form.get('usdtEnabled') === 'on',
      usdtNetwork: network,
      usdtAddress: text('usdtAddress'),
      usdtAddressConfirm: text('usdtAddressConfirm'),
      showTestWarning: form.get('showTestWarning') === 'on',
    };

    // The same checks as the API, so a typo is caught before the round trip and named precisely.
    const problems: string[] = [];
    if (body.bankAccountNumber !== body.bankAccountNumberConfirm) problems.push(t('mismatchNumber'));
    if (body.usdtAddress !== body.usdtAddressConfirm) problems.push(t('mismatchAddress'));
    if ((body.usdtEnabled || body.usdtAddress) && !isUsdtAddressFor(network, body.usdtAddress)) problems.push(t('badAddress'));
    setDone(false);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }

    setBusy(true);
    setErrors([]);
    try {
      const next = await apiFetch<AdminPaymentSettingsView>('/admin/payment-settings', { method: 'PUT', body });
      setView(next);
      setDone(true);
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <div className="space-y-3 text-sm">
        <p role="alert" className="text-error">
          {t('loadError')}
        </p>
        <Button variant="secondary" className="h-9" onClick={() => setAttempt((n) => n + 1)}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }
  if (!view) return <div className="h-40" aria-busy="true" />;

  return (
    // Keyed by the last save, so after saving the form shows what the server now holds (confirm fields included).
    <form key={view.updatedAt ?? 'env'} onSubmit={(event) => void submit(event)} className="max-w-3xl space-y-5">
      <div className="space-y-2 text-sm">
        <p className="text-muted">{t('intro')}</p>
        {!canEdit ? <p className="rounded-card border border-border bg-surface px-4 py-3 text-text">{t('readOnly')}</p> : null}
        {!view.saved ? <p className="rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-text">{t('envNotice')}</p> : null}
        {view.updatedBy && view.updatedAt ? (
          <p className="text-muted">
            {t('lastChanged', {
              name: view.updatedBy.name,
              date: format.dateTime(new Date(view.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }),
            })}
          </p>
        ) : null}
      </div>

      <fieldset disabled={!canEdit || busy} className="space-y-5">
        <Card title={t('bankTitle')} toggle={<Toggle name="bankEnabled" label={t('enabled')} defaultChecked={view.bankEnabled} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text name="bankName" label={t('bankName')} defaultValue={view.bankName} maxLength={BANK_LIMITS.bankNameMax} />
            <Text name="bankAccountHolder" label={t('accountHolder')} defaultValue={view.bankAccountHolder} maxLength={BANK_LIMITS.holderMax} />
            <Text
              name="bankAccountNumber"
              label={t('accountNumber')}
              helper={t('accountNumberHelper')}
              defaultValue={view.bankAccountNumber}
              inputMode="numeric"
              mono
            />
            {canEdit ? (
              <Text name="bankAccountNumberConfirm" label={t('accountNumberConfirm')} defaultValue={view.bankAccountNumber} inputMode="numeric" mono noPaste />
            ) : null}
          </div>
        </Card>

        <Card title={t('usdtTitle')} toggle={<Toggle name="usdtEnabled" label={t('enabled')} defaultChecked={view.usdtEnabled} />}>
          <div className="grid gap-4">
            <label className="block max-w-xs">
              <span className="block text-sm font-medium text-text">{t('network')}</span>
              <select value={network} onChange={(event) => setNetwork(event.target.value as UsdtNetwork)} className={`${inputClasses} mt-1`}>
                {USDT_NETWORKS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">{t('networkHelper')}</span>
            </label>
            <Text name="usdtAddress" label={t('address')} helper={t('addressHelper')} defaultValue={view.usdtAddress} mono />
            {canEdit ? <Text name="usdtAddressConfirm" label={t('addressConfirm')} defaultValue={view.usdtAddress} mono noPaste /> : null}
          </div>
        </Card>

        <Card title={t('warningTitle')}>
          <Toggle name="showTestWarning" label={t('warningLabel')} defaultChecked={view.showTestWarning} />
          <p className="mt-1 text-xs text-muted">{t('warningHelper')}</p>
          {view.exchangeIsPlaceholder ? (
            <p className="mt-3 rounded-card border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text">{t('exchangeNotice')}</p>
          ) : null}
        </Card>
      </fieldset>

      <FormErrors messages={errors} />
      {done ? (
        <p role="status" className="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {t('saved')}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" className="h-10" disabled={busy}>
            {busy ? t('saving') : t('save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function Card({ title, toggle, children }: { title: string; toggle?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {toggle}
      </div>
      {children}
    </section>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-text">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
}

/**
 * A text field. `noPaste` is for the "type it again" fields: pasting the first field into the second would defeat the
 * point of typing it twice.
 */
function Text({
  name,
  label,
  helper,
  defaultValue,
  maxLength = 64,
  inputMode,
  mono = false,
  noPaste = false,
}: {
  name: string;
  label: string;
  helper?: string;
  defaultValue: string;
  maxLength?: number;
  inputMode?: 'numeric';
  mono?: boolean;
  noPaste?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        onPaste={noPaste ? (event) => event.preventDefault() : undefined}
        className={`${inputClasses} mt-1 ${mono ? 'font-mono tracking-wide' : ''}`}
      />
      {helper ? <span className="mt-1 block text-xs text-muted">{helper}</span> : null}
    </label>
  );
}
