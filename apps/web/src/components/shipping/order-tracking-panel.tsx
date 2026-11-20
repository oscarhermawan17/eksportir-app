'use client';

import { TRACKING_LIMITS, TRACKING_MILESTONES, availableMilestones } from '@balitrade/shared';
import type { AddTrackingEventInput, OrderView, TrackingEventView, TrackingMilestone, TrackingResponse } from '@balitrade/shared';
import { CheckCircle2, Circle, Copy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { MediaUploader } from '@/components/media/media-uploader';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import type { UploadedMedia } from '@/lib/media';

/** Packing is recorded from QC approval on; the timeline matters to everyone from then until the end. */
const TRACKING_STATUSES = new Set(['QC_APPROVED', 'AWAITING_SHIPPING_PAYMENT', 'SHIPPING_PAID', 'SHIPPED', 'ARRIVED', 'COMPLETED']);

/** `datetime-local` wants local time without a zone. */
const localNow = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/**
 * The manual shipment timeline (T19) for the buyer, the seller and admins, with OPS's form to add a milestone. Only the
 * milestones that are possible in this status are offered; the API checks the same rule (`trackingMilestoneProblem`).
 */
export function OrderTrackingPanel({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const t = useTranslations('Tracking');
  const format = useFormatter();
  const { user } = useAuth();
  const [events, setEvents] = useState<TrackingEventView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);

  const relevant = TRACKING_STATUSES.has(order.status);

  useEffect(() => {
    if (!relevant) return;
    let cancelled = false;
    const load = () =>
      apiFetch<TrackingResponse>(`/orders/${order.id}/tracking`)
        .then((loaded) => {
          if (cancelled) return;
          setEvents(loaded.events);
          setFailed(false);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error('Could not load the tracking', error);
          setFailed(true);
        });
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [order.id, order.status, relevant, attempt]);

  if (!relevant) return null;

  const handlesOps = order.viewer === 'ADMIN' && Boolean(user?.roles.some((role) => role === 'ADMIN_OPS' || role === 'ADMIN_OWNER'));
  const done = new Map((events ?? []).map((event) => [event.milestone, event]));
  const addable = availableMilestones(order.status, [...done.keys()]);
  // Before anything is recorded the panel would be an empty list; buyers and sellers simply wait for the first step.
  if (events !== null && events.length === 0 && !handlesOps && !['SHIPPING_PAID', 'SHIPPED', 'ARRIVED'].includes(order.status)) return null;

  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  async function copy(awb: string) {
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the number stays visible to copy by hand.
    }
  }

  return (
    <section aria-labelledby="order-tracking" className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 id="order-tracking" className="text-xs font-bold uppercase tracking-wider text-muted">
        {t('title')}
      </h2>
      <p className="mt-1 text-xs text-muted">{t('manualNote')}</p>

      {failed ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-error">{t('loadError')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : events === null ? (
        <p className="mt-3 text-sm text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <ol className="space-y-4">
            {TRACKING_MILESTONES.map((milestone) => {
              const event = done.get(milestone);
              return (
                <li key={milestone} className="flex gap-3">
                  {event ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-border" aria-hidden="true" />
                  )}
                  <div className="min-w-0 text-sm">
                    <p className={event ? 'font-semibold text-text' : 'text-muted'}>
                      {t(`milestones.${milestone}`)}
                      <span className="sr-only"> — {event ? t('done') : t('notYet')}</span>
                    </p>
                    {event ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted">{when(event.occurredAt)}</p>
                        {event.awb ? (
                          <p className="flex flex-wrap items-center gap-2 text-text">
                            {t('awb')} <span className="font-mono font-semibold">{event.awb}</span>
                            <button
                              type="button"
                              onClick={() => void copy(event.awb!)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                              {copied ? t('copied') : t('copy')}
                            </button>
                          </p>
                        ) : null}
                        {event.note ? <p className="whitespace-pre-line break-words text-text">{event.note}</p> : null}
                        {event.photoUrl ? (
                          <a href={event.photoUrl} target="_blank" rel="noopener noreferrer" className="block w-32 overflow-hidden rounded-button border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link from the private bucket */}
                            <img src={event.photoUrl} alt={t('photoAlt', { step: t(`milestones.${milestone}`) })} loading="lazy" className="aspect-square w-full object-cover" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>

          {handlesOps && addable.length > 0 ? (
            <AddMilestoneForm
              orderId={order.id}
              options={addable}
              onAdded={(loaded) => {
                setEvents(loaded.events);
                onChanged();
              }}
              onStale={onChanged}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function AddMilestoneForm({
  orderId,
  options,
  onAdded,
  onStale,
}: {
  orderId: string;
  options: TrackingMilestone[];
  onAdded: (response: TrackingResponse) => void;
  onStale: () => void;
}) {
  const t = useTranslations('Tracking');
  const tErrors = useTranslations('Errors');
  const [milestone, setMilestone] = useState<TrackingMilestone>(options[0]!);
  const [occurredAt, setOccurredAt] = useState(localNow);
  const [awb, setAwb] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<UploadedMedia | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // The options shrink as milestones are added; keep the select on one that still exists.
  const chosen = options.includes(milestone) ? milestone : options[0]!;
  const needsAwb = chosen === 'HANDED_TO_CARGO';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanAwb = awb.replace(/\s+/g, '');
    if (needsAwb && !TRACKING_LIMITS.awbPattern.test(cleanAwb)) {
      setErrors([t('form.errAwb')]);
      return;
    }
    const at = new Date(occurredAt);
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 5 * 60_000) {
      setErrors([t('form.errDate')]);
      return;
    }
    const body: AddTrackingEventInput = {
      milestone: chosen,
      occurredAt: at.toISOString(),
      ...(needsAwb ? { awb: cleanAwb } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(photo ? { photoKey: photo.key } : {}),
    };
    setBusy(true);
    setErrors([]);
    try {
      const response = await apiFetch<TrackingResponse>(`/admin/orders/${orderId}/tracking`, { method: 'POST', body });
      setOccurredAt(localNow());
      setAwb('');
      setNote('');
      setPhoto(null);
      setUploaderKey((n) => n + 1);
      onAdded(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) onStale();
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-card border border-border bg-background/60 p-4" noValidate>
      <h3 className="text-base font-semibold text-text">{t('form.title')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-wider text-text">
          {t('form.milestone')}
          <select
            value={chosen}
            onChange={(event) => setMilestone(event.target.value as TrackingMilestone)}
            className="mt-1.5 h-10 w-full rounded-button border border-border bg-card px-2 text-sm font-medium normal-case tracking-normal text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {t(`milestones.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wider text-text">
          {t('form.when')}
          <input
            type="datetime-local"
            value={occurredAt}
            max={localNow()}
            onChange={(event) => setOccurredAt(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-button border border-border bg-card px-2 text-sm normal-case tracking-normal text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>
      {needsAwb ? (
        <label className="block text-xs font-bold uppercase tracking-wider text-text">
          {t('form.awb')} <span className="text-error">*</span>
          <input
            value={awb}
            onChange={(event) => setAwb(event.target.value)}
            placeholder="618-12345675"
            inputMode="numeric"
            className="mt-1.5 h-10 w-full rounded-button border border-border bg-card px-3 font-mono text-sm normal-case tracking-normal text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted">{t('form.awbHelper')}</span>
        </label>
      ) : null}
      <TextareaField id={`track-note-${orderId}`} label={t('form.note')} value={note} onChange={(event) => setNote(event.target.value)} maxLength={TRACKING_LIMITS.noteMax} rows={2} />
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-text">{t('form.photo')}</p>
        <MediaUploader
          key={uploaderKey}
          purpose="PRIVATE_FILE"
          onUploaded={(item) => {
            if (item.kind === 'IMAGE') setPhoto(item);
          }}
          onRemoved={(item) => setPhoto((current) => (current?.key === item.key ? null : current))}
        />
      </div>
      {needsAwb || chosen === 'DELIVERED' ? <p className="text-xs text-info">{t(needsAwb ? 'form.shipsHint' : 'form.deliversHint')}</p> : null}
      <FormErrors messages={errors} />
      <Button type="submit" disabled={busy}>
        {busy ? t('working') : t('form.submit')}
      </Button>
    </form>
  );
}
