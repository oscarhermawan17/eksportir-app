'use client';

import { QC_LIMITS } from '@balitrade/shared';
import type { OrderView, QcReportView, QcReportsResponse } from '@balitrade/shared';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { QcReportForm } from '@/components/qc/qc-report-form';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

/** From the moment QC starts the reports belong to the order's story, so they stay visible after shipping too. */
const QC_STATUSES = new Set([
  'IN_QC',
  'QC_READY',
  'QC_APPROVED',
  'ISSUE',
  'AWAITING_SHIPPING_PAYMENT',
  'SHIPPING_PAID',
  'SHIPPED',
  'ARRIVED',
  'COMPLETED',
]);

type Mode = 'confirmApprove' | 'issue' | null;

/**
 * Quality control on the order page (T18), for all three sides: the report itself (checklist, summary, photos and
 * videos), the buyer's answer, and the OPS admin's report form and "check again". The seller only reads — the
 * owner wants the report to be transparent to them too. The API decides who may do what; this only hides buttons.
 */
export function OrderQcPanel({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const t = useTranslations('Qc');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const { user } = useAuth();
  const [reports, setReports] = useState<QcReportView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  const relevant = QC_STATUSES.has(order.status);

  useEffect(() => {
    if (!relevant) return;
    let cancelled = false;
    const load = () =>
      apiFetch<QcReportsResponse>(`/orders/${order.id}/qc`)
        .then((loaded) => {
          if (cancelled) return;
          setReports(loaded.reports);
          setFailed(false);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error('Could not load the QC reports', error);
          setFailed(true);
        });
    void load();
    // The photo and video links expire after a few minutes; coming back to the tab fetches fresh ones.
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

  const holds = (role: string) => user?.roles.includes(role as never) ?? false;
  const handlesQc = order.viewer === 'ADMIN' && (holds('ADMIN_OPS') || holds('ADMIN_OWNER'));
  const isBuyer = order.viewer === 'BUYER';
  const [latest, ...earlier] = reports ?? [];
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  async function run(path: string, body: object = {}): Promise<boolean> {
    setBusy(true);
    setErrors([]);
    try {
      const updated = await apiFetch<QcReportsResponse>(path, { method: 'POST', body });
      setReports(updated.reports);
      setMode(null);
      setReason('');
      onChanged();
      return true;
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
      // 409: the order moved on meanwhile (an automatic approval, another admin); show the fresh state.
      if (error instanceof ApiError && error.status === 409) onChanged();
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < QC_LIMITS.issueReasonMin) {
      setErrors([t('reasonTooShort', { min: QC_LIMITS.issueReasonMin })]);
      return;
    }
    void run(`/orders/${order.id}/qc/report-issue`, { reason: reason.trim() });
  }

  function submitRedo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = String(new FormData(form).get('note') ?? '').trim();
    void run(`/admin/orders/${order.id}/redo-qc`, note ? { note } : {}).then((done) => done && form.reset());
  }

  return (
    <section aria-labelledby="order-qc" className="rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 id="order-qc" className="text-xs font-bold uppercase tracking-wider text-muted">
        {t('title')}
      </h2>

      {failed ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-error">{t('loadError')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : reports === null ? (
        <p className="mt-3 text-sm text-muted" aria-busy="true">
          {t('loading')}
        </p>
      ) : (
        <div className="mt-3 space-y-5">
          {order.status === 'IN_QC' && !handlesQc ? (
            <p className="text-sm text-text">{latest ? t('checkingAgain') : t('checking')}</p>
          ) : null}
          {order.status === 'ISSUE' ? <p className="text-sm text-text">{t('issueHint')}</p> : null}

          {order.status === 'IN_QC' && handlesQc ? (
            <QcReportForm
              orderId={order.id}
              onSent={(updated) => {
                setReports(updated.reports);
                onChanged();
              }}
              onStale={onChanged}
            />
          ) : null}

          {latest && !(order.status === 'IN_QC') ? <Report report={latest} /> : null}

          {order.status === 'QC_READY' && latest?.autoApproveAt ? (
            <p className="text-sm text-info">{t(isBuyer ? 'autoApproveBuyer' : 'autoApproveOthers', { date: when(latest.autoApproveAt) })}</p>
          ) : null}

          <FormErrors messages={errors} />

          {isBuyer && order.status === 'QC_READY' ? (
            mode === 'issue' ? (
              <form onSubmit={submitIssue} className="space-y-3">
                <TextareaField
                  id={`qc-issue-${order.id}`}
                  label={t('reasonLabel')}
                  helper={t('reasonHelper')}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={QC_LIMITS.issueReasonMin}
                  maxLength={QC_LIMITS.issueReasonMax}
                  rows={3}
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="danger" disabled={busy}>
                    {busy ? t('working') : t('sendIssue')}
                  </Button>
                  <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
                    {t('back')}
                  </Button>
                </div>
              </form>
            ) : mode === 'confirmApprove' ? (
              <div className="space-y-3">
                <p className="text-sm text-text">{t('approveConfirmText')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void run(`/orders/${order.id}/qc/approve`)}>
                    {busy ? t('working') : t('approveConfirm')}
                  </Button>
                  <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
                    {t('back')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setMode('confirmApprove')}>{t('approve')}</Button>
                <Button variant="secondary" onClick={() => setMode('issue')}>
                  {t('reportIssue')}
                </Button>
              </div>
            )
          ) : null}

          {order.status === 'ISSUE' && handlesQc ? (
            <form onSubmit={submitRedo} className="space-y-3 rounded-card border border-border bg-background/60 p-4">
              <div>
                <h3 className="text-base font-semibold text-text">{t('redoTitle')}</h3>
                <p className="mt-1 text-sm text-muted">{t('redoHint')}</p>
              </div>
              <TextareaField id={`qc-redo-${order.id}`} name="note" label={t('redoNote')} rows={2} maxLength={QC_LIMITS.redoNoteMax} />
              <Button type="submit" disabled={busy}>
                {busy ? t('working') : t('redoButton')}
              </Button>
            </form>
          ) : null}

          {/* While OPS checks again, the previous report is history too. */}
          {(order.status === 'IN_QC' ? (reports ?? []) : earlier).length > 0 ? (
            <details className="rounded-card border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold text-primary">{t('history')}</summary>
              <div className="mt-4 space-y-6">
                {(order.status === 'IN_QC' ? (reports ?? []) : earlier).map((report) => (
                  <Report key={report.id} report={report} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Report({ report }: { report: QcReportView }) {
  const t = useTranslations('Qc');
  const format = useFormatter();
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const passed = report.checklist.filter((entry) => entry.result === 'PASS').length;

  return (
    <article className="space-y-4" aria-label={t('roundLabel', { round: report.round })}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-base font-semibold text-text">{t('roundLabel', { round: report.round })}</p>
        <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-semibold text-text">{t(`status.${report.status}`)}</span>
        <p className="text-xs text-muted">
          {report.createdBy ? t('byOn', { name: report.createdBy.name, date: when(report.createdAt) }) : when(report.createdAt)}
        </p>
      </div>

      <p className="text-sm text-text">{t('passedCount', { passed, total: report.checklist.length })}</p>
      <ul className="space-y-2">
        {report.checklist.map((entry) => (
          <li key={entry.key} className="flex gap-2 text-sm">
            {entry.result === 'PASS' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
            )}
            <span>
              <span className="font-medium text-text">{t(`checklist.${entry.key}.label`)}</span>
              <span className="sr-only"> — {entry.result === 'PASS' ? t('pass') : t('fail')}</span>
              {entry.note ? <span className="block whitespace-pre-line break-words text-muted">{entry.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('commentLabel')}</p>
        <p className="mt-1 whitespace-pre-line break-words text-sm text-text">{report.comment}</p>
      </div>

      {report.media.length > 0 ? <Gallery media={report.media} /> : null}

      {report.status === 'APPROVED' && report.decidedAt ? (
        <p className="text-sm text-success">{report.autoApproved ? t('autoApproved', { date: when(report.decidedAt) }) : t('approvedOn', { date: when(report.decidedAt) })}</p>
      ) : null}
      {report.status === 'ISSUE' && report.issueReason ? (
        <div className="rounded-card border border-error/30 bg-error/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-error">{t('issueReason')}</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-text">{report.issueReason}</p>
        </div>
      ) : null}
    </article>
  );
}

function Gallery({ media }: { media: QcReportView['media'] }) {
  const t = useTranslations('Qc');
  // A signed link that expired while the page was open shows as a broken image; say so once instead of failing silently.
  const [expired, setExpired] = useState(false);
  const reported = useRef(false);
  const onError = () => {
    if (reported.current) return;
    reported.current = true;
    setExpired(true);
  };
  let photo = 0;
  let video = 0;

  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {media.map((item) =>
          item.kind === 'IMAGE' ? (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-button border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link from the private bucket */}
                <img src={item.url} alt={t('photoAlt', { n: ++photo })} loading="lazy" onError={onError} className="aspect-square w-full object-cover" />
              </a>
            </li>
          ) : (
            <li key={item.url} className="col-span-2 sm:col-span-3">
              <video src={item.url} controls preload="metadata" onError={onError} aria-label={t('videoAlt', { n: ++video })} className="w-full rounded-button border border-border bg-black" />
            </li>
          ),
        )}
      </ul>
      {expired ? <p className="text-xs text-muted">{t('linksExpired')}</p> : null}
    </div>
  );
}
