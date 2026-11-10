'use client';

import type { PaymentInstructions, PaymentMethod } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Account numbers and wallet addresses are long and easy to mistype, so each one can be copied. */
function Copyable({ label, value }: { label: string; value: string }) {
  const t = useTranslations('Payments');
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="break-all font-semibold text-text">{value}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(value)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
          className="rounded-button border border-border px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {copied ? t('copied') : t('copy')}
        </button>
      </dd>
    </div>
  );
}

/**
 * Where to send the money for one method. Everything here comes from the API (which reads it from config), so a
 * method that is not fully configured is never rendered — `instructions` simply has `null` for it.
 */
export function PaymentMethodCard({ method, instructions }: { method: PaymentMethod; instructions: PaymentInstructions }) {
  const t = useTranslations('Payments');

  if (method === 'BANK_IDR' && instructions.bank) {
    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        <Copyable label={t('bank.accountNumber')} value={instructions.bank.accountNumber} />
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('bank.accountHolder')}</dt>
          <dd className="mt-0.5 font-semibold text-text">{instructions.bank.accountHolder}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('bank.bankName')}</dt>
          <dd className="mt-0.5 font-semibold text-text">{instructions.bank.name}</dd>
        </div>
      </dl>
    );
  }

  if (method === 'USDT' && instructions.usdt) {
    return (
      <>
        {/* The network matters more than the address: sending on the wrong one loses the money for good. */}
        <p className="mb-3 rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-sm font-semibold text-text">
          {t('usdt.networkWarning', { network: instructions.usdt.network })}
        </p>
        <dl className="grid gap-3">
          <Copyable label={t('usdt.network')} value={instructions.usdt.network} />
          <Copyable label={t('usdt.address')} value={instructions.usdt.address} />
        </dl>
      </>
    );
  }

  if (method === 'EXCHANGE' && instructions.exchange) {
    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('exchange.name')}</dt>
          <dd className="mt-0.5 font-semibold text-text">{instructions.exchange.name}</dd>
        </div>
        <Copyable label={t('exchange.contact')} value={instructions.exchange.contact} />
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">{t('exchange.instructions')}</dt>
          <dd className="mt-0.5 whitespace-pre-line text-text">{instructions.exchange.instructions}</dd>
        </div>
      </dl>
    );
  }

  return null;
}
