'use client';

import { COMPLETION_LIMITS } from '@balitrade/shared';
import type { OrderPayoutView, OrderView, PayoutPreview, PayoutRecordView, RecordPayoutInput } from '@balitrade/shared';
import { AlertTriangle, Copy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { MediaUploader } from '@/components/media/media-uploader';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import type { UploadedMedia } from '@/lib/media';

/** The seller sees what they will receive from arrival on; the money only moves once the order is completed. */
const PAYOUT_STATUSES = new Set(['ARRIVED', 'DELIVERY_ISSUE', 'COMPLETED']);

const localNow = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/**
 * The seller's payout for one order (T20), between BaliTrade and the seller only — never rendered for the buyer, and
 * the API answers 404 to them. The seller sees the breakdown (their rupiah price minus the 1% commission) and, once
 * paid, the transfer; FINANCE and the OWNER also see the full account to transfer to; only the OWNER records it.
 */
export function OrderPayoutPanel({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const t = useTranslations('Payouts');
  const { user } = useAuth();
  const holds = (role: string) => user?.roles.includes(role as never) ?? false;
  const handlesMoney = order.viewer === 'ADMIN' && (holds('ADMIN_FINANCE') || holds('ADMIN_OWNER'));
  const isOwner = order.viewer === 'ADMIN' && holds('ADMIN_OWNER');
  const relevant = (order.viewer === 'SELLER' || handlesMoney) && PAYOUT_STATUSES.has(order.status);

  const [data, setData] = useState<OrderPayoutView | PayoutPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!relevant) return;
    let cancelled = false;
    const path = handlesMoney ? `/admin/orders/${order.id}/payout-preview` : `/orders/${order.id}/payout`;
    const load = () =>
      apiFetch<OrderPayoutView | PayoutPreview>(path)
        .then((loaded) => {
          if (cancelled) return;
          setData(loaded);
          setFailed(false);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error('Could not load the payout', error);
          setFailed(true);
        });
    void load();
    // The receipt link expires after a few minutes; coming back to the tab fetches a fresh one.
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [order.id, order.status, relevant, handlesMoney, attempt]);

  if (!relevant) return null;

  return (
    <section aria-labelledby="order-payout" className="rounded-card border border-border bg-card p-5">
      <h2 id="order-payout" className="text-base font-semibold text-text">
        {t('title')}
      </h2>
      {failed ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-error">{t('loadError')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : data === null ? (
        <p className="mt-3 text-sm text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          <Breakdown data={data} seller={order.viewer === 'SELLER'} />
          {data.payout ? (
            <Recorded payout={data.payout} />
          ) : order.status !== 'COMPLETED' ? (
            <p className="text-sm text-muted">{t('waitCompletion')}</p>
          ) : order.viewer === 'SELLER' ? (
            <p className="text-sm text-text">{t('sellerPending')}</p>
          ) : null}
          {'bank' in data && !data.payout && order.status === 'COMPLETED' ? (
            <AdminTransfer
              preview={data}
              orderId={order.id}
              canRecord={isOwner}
              onRecorded={(updated) => {
                setData({ ...data, ...updated });
                onChanged();
              }}
              onStale={() => setAttempt((n) => n + 1)}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function useRupiah() {
  const format = useFormatter();
  return (idr: number) => `Rp ${format.number(idr)}`;
}

function Breakdown({ data, seller }: { data: OrderPayoutView; seller: boolean }) {
  const t = useTranslations('Payouts');
  const rupiah = useRupiah();
  const { breakdown } = data;
  const percent = Number(breakdown.commissionRate) * 100;
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between gap-3 text-text">
        <dt>{t('gross')}</dt>
        <dd className="tabular-nums">{rupiah(breakdown.grossIdr)}</dd>
      </div>
      <div className="flex justify-between gap-3 text-text">
        <dt>{t('commission', { percent })}</dt>
        <dd className="tabular-nums">− {rupiah(breakdown.commissionIdr)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold text-text">
        <dt>{seller ? t('netSeller') : t('netAdmin')}</dt>
        <dd className="tabular-nums">{rupiah(breakdown.netIdr)}</dd>
      </div>
    </dl>
  );
}

function Recorded({ payout }: { payout: PayoutRecordView }) {
  const t = useTranslations('Payouts');
  const format = useFormatter();
  const rupiah = useRupiah();
  return (
    <div className="space-y-2 rounded-card border border-success/30 bg-success/5 p-4 text-sm">
      <p className="font-semibold text-success">
        {t('paidOn', { amount: rupiah(payout.netIdr), date: format.dateTime(new Date(payout.paidAt), { dateStyle: 'medium' }) })}
      </p>
      <p className="text-text">
        {t('paidTo', { bank: payout.bankName, account: payout.accountMasked, holder: payout.accountHolder })}
      </p>
      {payout.transferReference ? <p className="text-text">{t('reference', { reference: payout.transferReference })}</p> : null}
      {payout.note ? <p className="whitespace-pre-line break-words text-text">{payout.note}</p> : null}
      <a href={payout.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-primary hover:underline">
        {t('viewProof')}
      </a>
    </div>
  );
}

function AdminTransfer({
  preview,
  orderId,
  canRecord,
  onRecorded,
  onStale,
}: {
  preview: PayoutPreview;
  orderId: string;
  canRecord: boolean;
  onRecorded: (view: OrderPayoutView) => void;
  onStale: () => void;
}) {
  const t = useTranslations('Payouts');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [paidAt, setPaidAt] = useState(localNow);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<UploadedMedia | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const { bank, shop } = preview;

  if (!bank) {
    return <p className="rounded-card border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-text">{t('noBank', { shop: shop.displayName })}</p>;
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the number stays visible to copy by hand.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const at = new Date(paidAt);
    const problems: string[] = [];
    if (!proof) problems.push(t('errProof'));
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 5 * 60_000) problems.push(t('errDate'));
    if (problems.length > 0 || !proof) {
      setErrors(problems);
      return;
    }
    const body: RecordPayoutInput = {
      proofKey: proof.key,
      paidAt: at.toISOString(),
      ...(reference.trim() ? { transferReference: reference.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    setBusy(true);
    setErrors([]);
    try {
      const view = await apiFetch<OrderPayoutView>(`/admin/orders/${orderId}/payout`, { method: 'POST', body });
      setReference('');
      setNote('');
      setProof(null);
      setUploaderKey((n) => n + 1);
      onRecorded(view);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) onStale();
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-card border border-border bg-background/60 p-4">
      <div className="space-y-1 text-sm">
        <p className="text-sm font-medium text-muted">{t('transferTo')}</p>
        <p className="text-text">
          {bank.bankName} · <span className="font-mono font-semibold">{bank.accountNumber}</span>{' '}
          <button type="button" onClick={() => void copy(bank.accountNumber)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? t('copied') : t('copy')}
          </button>
        </p>
        <p className="text-text">{t('holder', { holder: bank.accountHolder, shop: shop.displayName, owner: shop.ownerName })}</p>
        <p className="text-xs text-muted">{t('bankUpdated', { date: format.dateTime(new Date(bank.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
      </div>
      {bank.changedRecently ? (
        <p role="alert" className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          {t('recentWarning')}
        </p>
      ) : null}

      {canRecord ? (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <h3 className="text-base font-semibold text-text">{t('recordTitle')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-text">
              {t('paidAt')}
              <input
                type="datetime-local"
                value={paidAt}
                max={localNow()}
                onChange={(event) => setPaidAt(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-button border border-border bg-card px-2 text-sm normal-case tracking-normal text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <label className="text-sm font-medium text-text">
              {t('referenceLabel')}
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={COMPLETION_LIMITS.referenceMax}
                className="mt-1.5 h-10 w-full rounded-button border border-border bg-card px-3 text-sm normal-case tracking-normal text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-text">
              {t('proof')} <span className="text-error">*</span>
            </p>
            <MediaUploader
              key={uploaderKey}
              purpose="PRIVATE_FILE"
              onUploaded={(item) => {
                if (item.kind === 'IMAGE') setProof(item);
              }}
              onRemoved={(item) => setProof((current) => (current?.key === item.key ? null : current))}
            />
          </div>
          <TextareaField id={`payout-note-${orderId}`} label={t('noteLabel')} value={note} onChange={(event) => setNote(event.target.value)} maxLength={COMPLETION_LIMITS.noteMax} rows={2} />
          <FormErrors messages={errors} />
          <Button type="submit" disabled={busy}>
            {busy ? t('working') : t('recordButton')}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted">{t('ownerOnly')}</p>
      )}
    </div>
  );
}
