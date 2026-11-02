'use client';

import type { OrderView } from '@balitrade/shared';
import { ORDER_LIMITS } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

type Mode = 'propose' | 'decline' | 'cancel' | null;

/**
 * What the viewer can do with an order now (the API sends the list in `order.actions` and checks it again on every call):
 * the seller answers a request, the buyer decides about a proposed change or cancels.
 */
export function OrderActions({ order, onUpdated, onStale }: { order: OrderView; onUpdated: (order: OrderView) => void; onStale: () => void }) {
  const t = useTranslations('Orders.actions');
  const tProducts = useTranslations('Products');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (order.actions.length === 0) return null;
  const can = (action: OrderView['actions'][number]) => order.actions.includes(action);
  const money = (usd: string) => format.number(Number(usd), { style: 'currency', currency: 'USD' });

  async function run(path: string, body: object = {}) {
    setBusy(true);
    setErrors([]);
    try {
      const updated = await apiFetch<OrderView>(`/orders/${order.id}/${path}`, { method: 'POST', body });
      setMode(null);
      onUpdated(updated);
    } catch (error) {
      // 409: someone else changed the order first; show the fresh state.
      if (error instanceof ApiError && error.status === 409) onStale();
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  function submit(path: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const reason = String(form.get('reason') ?? '').trim();
      const body: Record<string, unknown> = reason ? { reason } : {};
      if (path === 'propose-change') body['qty'] = Number(form.get('qty'));
      void run(path, body);
    };
  }

  const reasonField = (
    <TextareaField id={`action-reason-${mode}`} name="reason" label={t('reason')} helper={t('reasonHelper')} rows={2} maxLength={ORDER_LIMITS.reasonMax} />
  );
  const back = (
    <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
      {t('back')}
    </Button>
  );

  const seller = order.viewer === 'SELLER';
  const proposal = order.proposal;

  return (
    <section aria-labelledby="order-actions" className="rounded-card border border-gold/50 bg-gold/10 p-5 shadow-sm">
      {seller ? (
        <>
          <h2 id="order-actions" className="text-base font-semibold text-text">
            {t('sellerTitle')}
          </h2>
          <p className="mt-1 text-sm text-muted">{order.status === 'CHANGE_PROPOSED' ? t('sellerWaiting') : t('sellerHint')}</p>
        </>
      ) : proposal ? (
        <>
          <h2 id="order-actions" className="text-base font-semibold text-text">
            {t('proposalTitle')}
          </h2>
          <p className="mt-1 text-sm text-text">
            {t('proposalText', {
              qty: format.number(proposal.qty),
              old: format.number(order.item.qty),
              unit: tProducts(`units.${order.item.unit}`),
              items: money(proposal.itemsUsd),
              total: money(proposal.totalUsd),
            })}
          </p>
        </>
      ) : (
        <>
          <h2 id="order-actions" className="sr-only">
            {t('cancel')}
          </h2>
          <p className="text-sm text-muted">{t('buyerHint')}</p>
        </>
      )}

      <div className="mt-4 space-y-3">
        <FormErrors messages={errors} />

        {mode === 'propose' ? (
          <form onSubmit={submit('propose-change')} className="space-y-3">
            <Field
              id="action-qty"
              name="qty"
              label={t('proposeQty')}
              helper={t('proposeQtyHelper', { qty: format.number(order.item.qty) })}
              type="number"
              inputMode="numeric"
              min={1}
              max={order.item.qty - 1}
              step={1}
              required
              defaultValue={Math.max(1, order.item.qty - 1)}
            />
            {reasonField}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? t('working') : t('sendProposal')}
              </Button>
              {back}
            </div>
          </form>
        ) : mode === 'decline' || mode === 'cancel' ? (
          <form onSubmit={submit(mode)} className="space-y-3">
            {reasonField}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" disabled={busy}>
                {busy ? t('working') : mode === 'decline' ? t('confirmDecline') : t('confirmCancel')}
              </Button>
              {back}
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {can('ACCEPT') ? (
              <Button onClick={() => void run('accept')} disabled={busy}>
                {busy ? t('working') : t('accept')}
              </Button>
            ) : null}
            {can('ACCEPT_CHANGE') ? (
              <Button onClick={() => void run('accept-change')} disabled={busy}>
                {busy ? t('working') : t('acceptChange')}
              </Button>
            ) : null}
            {can('PROPOSE_CHANGE') ? (
              <Button variant="secondary" onClick={() => setMode('propose')} disabled={busy}>
                {order.status === 'CHANGE_PROPOSED' ? t('reviseProposal') : t('propose')}
              </Button>
            ) : null}
            {can('DECLINE') ? (
              <Button variant="danger" onClick={() => setMode('decline')} disabled={busy}>
                {order.status === 'CHANGE_PROPOSED' ? t('withdraw') : t('decline')}
              </Button>
            ) : null}
            {can('CANCEL') ? (
              <Button variant="danger" onClick={() => setMode('cancel')} disabled={busy}>
                {t('cancel')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
