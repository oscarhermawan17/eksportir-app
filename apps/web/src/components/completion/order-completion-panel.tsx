'use client';

import { COMPLETION_LIMITS } from '@balitrade/shared';
import type { OrderView } from '@balitrade/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

type Mode = 'confirm' | 'issue' | 'complete' | null;

/**
 * The end of an order (T20). The buyer confirms the goods arrived, or reports a problem first; the OWNER can complete
 * an order by hand with a note. Nothing completes by itself (owner, 2026-11-21). The API checks every rule again.
 */
export function OrderCompletionPanel({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const t = useTranslations('Completion');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const arrived = order.status === 'ARRIVED';
  const issue = order.status === 'DELIVERY_ISSUE';
  const completed = order.status === 'COMPLETED';
  if (!arrived && !issue && !completed) return null;

  const isBuyer = order.viewer === 'BUYER';
  const isOwner = order.viewer === 'ADMIN' && Boolean(user?.roles.includes('ADMIN_OWNER'));

  async function run(path: string, body: object = {}) {
    setBusy(true);
    setErrors([]);
    try {
      await apiFetch(path, { method: 'POST', body });
      setMode(null);
      setText('');
      onChanged();
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
      // 409: someone else moved the order first (the buyer confirmed while the owner was typing); show the fresh state.
      if (error instanceof ApiError && error.status === 409) onChanged();
    } finally {
      setBusy(false);
    }
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (mode === 'issue') {
      if (value.length < COMPLETION_LIMITS.issueReasonMin) return setErrors([t('reasonTooShort', { min: COMPLETION_LIMITS.issueReasonMin })]);
      void run(`/orders/${order.id}/report-delivery-issue`, { reason: value });
    } else {
      if (value.length < COMPLETION_LIMITS.noteMin) return setErrors([t('noteTooShort', { min: COMPLETION_LIMITS.noteMin })]);
      void run(`/admin/orders/${order.id}/complete`, { note: value });
    }
  }

  const back = (
    <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
      {t('back')}
    </Button>
  );

  return (
    <section
      aria-labelledby="order-completion"
      className={`rounded-card border p-5 shadow-sm ${completed ? 'border-success/30 bg-success/5' : 'border-gold/50 bg-gold/10'}`}
    >
      <h2 id="order-completion" className="text-base font-semibold text-text">
        {completed ? t('completedTitle') : issue ? t('issueTitle') : isBuyer ? t('arrivedTitle') : t('arrivedTitleOthers')}
      </h2>
      <p className="mt-1 text-sm text-text">
        {completed
          ? t('completedText')
          : issue
            ? t('issueText')
            : isBuyer
              ? t('arrivedBuyer')
              : t('arrivedOthers')}
      </p>

      <div className="mt-4 space-y-3">
        <FormErrors messages={errors} />

        {mode === 'confirm' ? (
          <div className="space-y-3">
            <p className="text-sm text-text">{t('confirmText')}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void run(`/orders/${order.id}/confirm-received`)}>
                {busy ? t('working') : t('confirmYes')}
              </Button>
              {back}
            </div>
          </div>
        ) : mode === 'issue' || mode === 'complete' ? (
          <form onSubmit={submitText} className="space-y-3">
            <TextareaField
              id={`completion-${mode}-${order.id}`}
              label={mode === 'issue' ? t('reasonLabel') : t('noteLabel')}
              helper={mode === 'issue' ? t('reasonHelper') : t('noteHelper')}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={mode === 'issue' ? COMPLETION_LIMITS.issueReasonMax : COMPLETION_LIMITS.noteMax}
              rows={3}
              required
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant={mode === 'issue' ? 'danger' : 'primary'} disabled={busy}>
                {busy ? t('working') : mode === 'issue' ? t('sendIssue') : t('completeYes')}
              </Button>
              {back}
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {isBuyer && (arrived || issue) ? <Button onClick={() => setMode('confirm')}>{t('confirmButton')}</Button> : null}
            {isBuyer && arrived ? (
              <Button variant="secondary" onClick={() => setMode('issue')}>
                {t('issueButton')}
              </Button>
            ) : null}
            {isOwner && (arrived || issue) ? (
              <Button variant="secondary" onClick={() => setMode('complete')}>
                {t('completeButton')}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {completed && order.updatedAt ? (
        <p className="mt-2 text-xs text-muted">{t('completedOn', { date: format.dateTime(new Date(order.updatedAt), { dateStyle: 'medium' }) })}</p>
      ) : null}
    </section>
  );
}
