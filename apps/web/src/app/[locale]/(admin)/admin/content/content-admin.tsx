'use client';

import {
  CONTENT_KINDS,
  CONTENT_LIMITS,
  type AdminContentItemView,
  type ContentItemInput,
  type ContentKind,
} from '@balitrade/shared';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { StatusTabs } from '@/components/admin/status-tabs';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { FormErrors, inputClasses } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { ApiError, apiFetch, errorKey } from '@/lib/api';
import { useTableQuery } from '@/lib/table-query';

const LANGS = ['en', 'id', 'ru'] as const;
type Lang = (typeof LANGS)[number];
const field = (part: 'title' | 'body', lang: Lang) => `${part}${lang[0]!.toUpperCase()}${lang[1]}` as keyof ContentItemInput;

export function ContentAdmin() {
  return <LoginGate allow={(user) => user.roles.includes('ADMIN_OWNER')}>{() => <Content />}</LoginGate>;
}

/**
 * The steps and questions of /how-it-works (2026-11-26). Both kinds share one form — a title and a body in each of the
 * three languages — and differ only in how the site shows them: steps numbered by position, questions as an
 * accordion. The tab lives in the URL like every other admin filter.
 */
function Content() {
  const t = useTranslations('AdminContent');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const table = useTableQuery();
  const kind: ContentKind = table.get('tab') === 'FAQ' ? 'FAQ' : 'HOW_IT_WORKS_STEP';

  const [items, setItems] = useState<AdminContentItemView[] | null>(null);
  const [loadedKind, setLoadedKind] = useState<ContentKind | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminContentItemView[]>(`/admin/content?kind=${kind}`)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setLoadedKind(kind);
        setFailed(false);
      })
      .catch((error: unknown) => {
        console.error('Could not load the content', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, attempt]);

  const rows = loadedKind === kind ? items : null;
  const reload = () => setAttempt((n) => n + 1);

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setErrors([]);
    try {
      await action();
      after?.();
      reload();
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
      // Somebody else changed or deleted it meanwhile: show what is true now.
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) reload();
    } finally {
      setBusy(false);
    }
  }

  const switchTab = (next: string) => {
    setEditing(null);
    setConfirming(null);
    setErrors([]);
    table.set({ tab: next === 'HOW_IT_WORKS_STEP' ? '' : next });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-[70ch] text-sm text-muted">{t('intro')}</p>
        <Link
          href="/how-it-works"
          target="_blank"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('viewPage')}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="rounded-card border border-border bg-card">
        <div className="border-b border-border">
          <StatusTabs
            label={t('tabsLabel')}
            active={kind}
            onChange={switchTab}
            tabs={CONTENT_KINDS.map((key) => ({ key, label: t(`tabs.${key}`), count: key === kind && rows ? rows.length : undefined }))}
          />
        </div>

        <div className="p-4">
          <FormErrors messages={errors} />
        </div>

        {failed ? (
          <div className="px-4 pb-6 text-sm text-error">
            <p role="alert">{t('loadError')}</p>
            <Button variant="secondary" className="mt-3 h-9" onClick={reload}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : rows === null ? (
          <div className="h-40" aria-busy="true" />
        ) : (
          <ol className="divide-y divide-border border-t border-border">
            {rows.length === 0 ? <li className="px-4 py-10 text-center text-sm text-muted">{t('empty')}</li> : null}
            {rows.map((item, index) => (
              <li key={item.id} className={item.active ? '' : 'bg-surface/60'}>
                {editing === item.id ? (
                  <ContentForm
                    key={`${item.id}-${item.updatedAt}`}
                    kind={kind}
                    heading={t(`editTitle.${kind}`, { n: index + 1 })}
                    initial={item}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={(body) =>
                      void run(
                        () => apiFetch(`/admin/content/${item.id}`, { method: 'PATCH', body }),
                        () => setEditing(null),
                      )
                    }
                  />
                ) : (
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4">
                    {kind === 'HOW_IT_WORKS_STEP' ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold tabular-nums text-white">
                        {index + 1}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-text">{item.titleEn}</p>
                        {item.active ? null : (
                          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted">{t('hidden')}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {item.titleId} · {item.titleRu}
                      </p>
                      <p className="mt-1 line-clamp-2 max-w-[80ch] text-sm text-muted">{item.bodyEn}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <IconButton label={t('moveUp')} disabled={busy || index === 0} onClick={() => void run(() => apiFetch(`/admin/content/${item.id}/move`, { method: 'POST', body: { direction: 'up' } }))}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={t('moveDown')}
                        disabled={busy || index === rows.length - 1}
                        onClick={() => void run(() => apiFetch(`/admin/content/${item.id}/move`, { method: 'POST', body: { direction: 'down' } }))}
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      <Button variant="ghost" className="h-9 px-3" disabled={busy} onClick={() => { setConfirming(null); setEditing(item.id); }}>
                        {t('edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3"
                        disabled={busy}
                        onClick={() => void run(() => apiFetch(`/admin/content/${item.id}`, { method: 'PATCH', body: { active: !item.active } }))}
                      >
                        {item.active ? t('hide') : t('show')}
                      </Button>
                      <Button variant="ghost" className="h-9 px-3 text-error! hover:bg-error/5" disabled={busy} onClick={() => setConfirming(item.id)}>
                        {t('delete')}
                      </Button>
                    </div>
                    {confirming === item.id ? (
                      <div role="alertdialog" aria-label={t('confirmDelete')} className="flex w-full flex-wrap items-center justify-end gap-2 rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm">
                        <p className="mr-auto text-error">{t('confirmDelete')}</p>
                        <Button variant="secondary" className="h-9" onClick={() => setConfirming(null)}>
                          {t('cancel')}
                        </Button>
                        <Button
                          variant="danger"
                          className="h-9"
                          disabled={busy}
                          onClick={() => void run(() => apiFetch(`/admin/content/${item.id}`, { method: 'DELETE' }), () => setConfirming(null))}
                        >
                          {t('confirmDeleteYes')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="border-t border-border p-4">
          {editing === 'new' ? (
            <ContentForm
              key={`new-${kind}-${attempt}`}
              kind={kind}
              heading={t(`newTitle.${kind}`)}
              busy={busy}
              onCancel={() => setEditing(null)}
              onSave={(body) =>
                void run(
                  () => apiFetch('/admin/content', { method: 'POST', body: { ...body, kind } }),
                  () => setEditing(null),
                )
              }
            />
          ) : (
            <Button className="h-10" disabled={rows === null} onClick={() => { setConfirming(null); setEditing('new'); }}>
              {t(`add.${kind}`)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The one form both kinds share: a title and a body in each language, side by side on a wide screen, stacked on a
 * phone. All six fields are required, so a save always leaves the site complete in every language.
 */
function ContentForm({
  kind,
  heading,
  initial,
  busy,
  onCancel,
  onSave,
}: {
  kind: ContentKind;
  heading: string;
  initial?: AdminContentItemView;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Omit<ContentItemInput, 'kind'>) => void;
}) {
  const t = useTranslations('AdminContent');
  const id = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      LANGS.flatMap((lang) => [field('title', lang), field('body', lang)]).map((name) => [name, String(form.get(name) ?? '').trim()]),
    ) as Omit<ContentItemInput, 'kind'>;
    onSave(body);
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 py-4" aria-label={heading}>
      <h3 className="text-base font-semibold text-text">{heading}</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        {LANGS.map((lang) => (
          <fieldset key={lang} className="space-y-3 rounded-card border border-border bg-card p-3">
            <legend className="px-1 text-sm font-medium text-muted">{t(`languages.${lang}`)}</legend>
            <label className="block">
              <span className="block text-sm font-medium text-text">{t(`titleLabel.${kind}`)}</span>
              <input
                id={`${id}-${lang}-title`}
                name={field('title', lang)}
                required
                maxLength={CONTENT_LIMITS.titleMax}
                defaultValue={initial ? initial[field('title', lang) as keyof AdminContentItemView] as string : ''}
                lang={lang}
                autoComplete="off"
                className={`${inputClasses} mt-1`}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-text">{t(`bodyLabel.${kind}`)}</span>
              <textarea
                id={`${id}-${lang}-body`}
                name={field('body', lang)}
                required
                rows={4}
                maxLength={CONTENT_LIMITS.bodyMax}
                defaultValue={initial ? initial[field('body', lang) as keyof AdminContentItemView] as string : ''}
                lang={lang}
                className={`${inputClasses} mt-1`}
              />
            </label>
          </fieldset>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" className="h-10" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </Button>
        <Button type="submit" className="h-10" disabled={busy}>
          {busy ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-button text-text transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
    </button>
  );
}
