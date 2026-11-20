'use client';

import { QC_CHECKLIST, QC_LIMITS, qcChecklistProblem } from '@balitrade/shared';
import type { QcChecklistEntry, QcChecklistKey, QcReportsResponse, QcResult } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { MediaUploader } from '@/components/media/media-uploader';
import { Button } from '@/components/ui/button';
import { FormErrors, TextareaField } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import type { UploadedMedia } from '@/lib/media';

type Line = { result: QcResult | ''; note: string };
const emptyLines = (): Record<QcChecklistKey, Line> =>
  Object.fromEntries(QC_CHECKLIST.map((key) => [key, { result: '', note: '' }])) as Record<QcChecklistKey, Line>;

/**
 * The OPS admin's QC report (T18): the fixed checklist, a summary for the buyer, and photos/videos uploaded to the
 * private bucket. The API checks all of it again; the checks here only save a round trip.
 */
export function QcReportForm({ orderId, onSent, onStale }: { orderId: string; onSent: (reports: QcReportsResponse) => void; onStale: () => void }) {
  const t = useTranslations('Qc');
  const tErrors = useTranslations('Errors');
  const [lines, setLines] = useState(emptyLines);
  const [comment, setComment] = useState('');
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  // A new key remounts the uploader, which is how its own list of files is emptied after a report was sent.
  const [uploaderKey, setUploaderKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const setLine = (key: QcChecklistKey, patch: Partial<Line>) => setLines((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problems: string[] = [];
    if (QC_CHECKLIST.some((key) => lines[key].result === '')) problems.push(t('form.errPick'));
    const checklist: QcChecklistEntry[] = QC_CHECKLIST.map((key) => ({
      key,
      result: (lines[key].result || 'PASS') as QcResult,
      ...(lines[key].note.trim() ? { note: lines[key].note.trim() } : {}),
    }));
    if (problems.length === 0 && qcChecklistProblem(checklist) === 'FAIL_NEEDS_NOTE') problems.push(t('form.errNote'));
    if (!comment.trim()) problems.push(t('form.errComment'));
    if (!media.some((item) => item.kind === 'IMAGE')) problems.push(t('form.errPhoto'));
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }

    setBusy(true);
    setErrors([]);
    try {
      const reports = await apiFetch<QcReportsResponse>(`/admin/orders/${orderId}/qc-report`, {
        method: 'POST',
        body: { checklist, comment: comment.trim(), media: media.map((item) => ({ key: item.key })) },
      });
      // The page stays mounted when the admin moves on (see AGENTS.md), so the form empties itself.
      setLines(emptyLines());
      setComment('');
      setMedia([]);
      setUploaderKey((n) => n + 1);
      onSent(reports);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) onStale();
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h3 className="text-base font-semibold text-text">{t('form.title')}</h3>
        <p className="mt-1 text-sm text-muted">{t('form.hint')}</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wider text-text">{t('form.checklistLabel')}</legend>
        {QC_CHECKLIST.map((key) => {
          const line = lines[key];
          return (
            <div key={key} className="rounded-card border border-border bg-background/60 p-3">
              <fieldset>
                <legend className="text-sm font-semibold text-text">{t(`checklist.${key}.label`)}</legend>
                <p className="text-xs text-muted">{t(`checklist.${key}.hint`)}</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {(['PASS', 'FAIL'] as const).map((result) => (
                    <label key={result} className="flex items-center gap-2 text-sm text-text">
                      <input
                        type="radio"
                        name={`qc-${key}`}
                        value={result}
                        checked={line.result === result}
                        onChange={() => setLine(key, { result })}
                        className="h-4 w-4 accent-primary"
                      />
                      {result === 'PASS' ? t('pass') : t('fail')}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label htmlFor={`qc-note-${key}`} className="mt-2 block text-xs font-semibold text-muted">
                {line.result === 'FAIL' ? t('form.noteRequired') : t('form.noteOptional')}
              </label>
              <input
                id={`qc-note-${key}`}
                value={line.note}
                onChange={(event) => setLine(key, { note: event.target.value })}
                maxLength={QC_LIMITS.noteMax}
                aria-invalid={line.result === 'FAIL' && !line.note.trim() ? true : undefined}
                className="mt-1 h-9 w-full rounded-button border border-border bg-card px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          );
        })}
      </fieldset>

      <TextareaField
        id={`qc-comment-${orderId}`}
        label={t('form.commentLabel')}
        helper={t('form.commentHelper')}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={QC_LIMITS.commentMax}
        rows={3}
        required
      />

      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-text">{t('form.mediaLabel')}</p>
        <p className="text-xs text-muted">{t('form.mediaHelper', { max: QC_LIMITS.mediaMax })}</p>
        <MediaUploader
          key={uploaderKey}
          purpose="PRIVATE_FILE"
          onUploaded={(item) => setMedia((current) => [...current, item])}
          onRemoved={(item) => setMedia((current) => current.filter((other) => other.key !== item.key))}
        />
      </div>

      <FormErrors messages={errors} />
      <Button type="submit" disabled={busy || media.length > QC_LIMITS.mediaMax}>
        {busy ? t('working') : t('form.submit')}
      </Button>
    </form>
  );
}
