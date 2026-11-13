'use client';

import { CATEGORY_LIMITS } from '@balitrade/shared';
import type {
  AdminProductCategoryView,
  ProductCategoryCreateInput,
  ProductCategoryUpdateInput,
} from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { LoginGate } from '@/components/auth/login-gate';
import { Button } from '@/components/ui/button';
import { Field, FormErrors } from '@/components/ui/field';
import { ApiError, apiFetch, errorKey } from '@/lib/api';

/**
 * What may be sold at all. Switching a category off takes every listing in it out of the shop at once —
 * the listings keep their status, so switching it back on restores them — which is why this is the
 * owner's page and not an OPS one (T26).
 *
 * Nothing here deletes anything (owner's decision 2026-11-12): off and archived cover every real case and
 * both are reversible, so the page has no irreversible button at all.
 *
 * Two different safeguards, because the two actions are not alike (owner's decision 2026-11-13):
 * - "In the shop" is a frequent, easily mistaken click, so it is **staged**: the tick changes on screen,
 *   nothing reaches the API until Save. An accidental click costs nothing.
 * - Archiving is rare and moves the category out of the list, so it asks first and then saves at once.
 *   Staging it would mean a row sitting in the wrong section waiting for a Save nobody pressed.
 */
export function CategoriesAdmin() {
  return <LoginGate allow={(user) => user.roles.includes('ADMIN_OWNER')}>{() => <Page />}</LoginGate>;
}

function Page() {
  const t = useTranslations('AdminCategories');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');

  const [rows, setRows] = useState<AdminProductCategoryView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  /** Staged "In the shop" ticks, by category id. Only Save sends them. */
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  const [toArchive, setToArchive] = useState<AdminProductCategoryView | null>(null);

  const reload = () => {
    setRows(null);
    setLoadFailed(false);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch<AdminProductCategoryView[]>(`/admin/categories${showArchived ? '?archived=true' : ''}`)
      .then((result) => !cancelled && setRows(result))
      .catch((error: unknown) => {
        console.error('Could not load categories', error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, showArchived]);

  /**
   * A staged tick only counts while it still differs from what the server holds. Comparing on every
   * render rather than pruning the map means a reload cannot leave a stale entry behind, and the Save
   * bar disappears by itself once the change has landed.
   */
  const changed = (rows ?? []).filter((row) => staged[row.id] !== undefined && staged[row.id] !== row.active);

  /** Immediate PATCH, for the things that are not staged: labels, position, restore. */
  async function patch(id: string, body: ProductCategoryUpdateInput): Promise<void> {
    setBusyId(id);
    setErrors([]);
    try {
      await apiFetch<AdminProductCategoryView>(`/admin/categories/${id}`, { method: 'PATCH', body });
      reload();
    } catch (error) {
      setErrors([message(error, tErrors)]);
    } finally {
      setBusyId(null);
    }
  }

  async function saveStaged(): Promise<void> {
    setSaving(true);
    setErrors([]);
    const failed: string[] = [];
    for (const row of changed) {
      try {
        await apiFetch<AdminProductCategoryView>(`/admin/categories/${row.id}`, {
          method: 'PATCH',
          body: { active: staged[row.id] } satisfies ProductCategoryUpdateInput,
        });
      } catch (error) {
        // One failure must not hide the others, and must not look like a success.
        failed.push(`${row.nameEn}: ${message(error, tErrors)}`);
      }
    }
    setSaving(false);
    setStaged({});
    if (failed.length > 0) setErrors(failed);
    reload();
  }

  async function confirmArchive(): Promise<void> {
    const row = toArchive;
    if (!row) return;
    setToArchive(null);
    // Staged ticks for other rows survive: they are keyed by id and re-checked against the reloaded data.
    await patch(row.id, { archived: true });
  }

  const visible = rows ?? [];
  const activeRows = visible.filter((row) => row.archivedAt === null);
  const archivedRows = visible.filter((row) => row.archivedAt !== null);

  const list = (section: AdminProductCategoryView[], emptyText: string) =>
    section.length === 0 ? (
      <p className="mt-3 rounded-card border border-border bg-card px-5 py-6 text-center text-sm text-muted">
        {emptyText}
      </p>
    ) : (
      <ul className="mt-3 space-y-3">
        {section.map((row) => (
          <Row
            key={row.id}
            row={row}
            busy={busyId === row.id || saving}
            inShop={staged[row.id] ?? row.active}
            dirty={staged[row.id] !== undefined && staged[row.id] !== row.active}
            onToggleInShop={(next) => setStaged((current) => ({ ...current, [row.id]: next }))}
            onArchive={() => setToArchive(row)}
            onRestore={() => void patch(row.id, { archived: false })}
            onSaveLabels={(body) => void patch(row.id, body)}
          />
        ))}
      </ul>
    );

  return (
    <div>
      <p className="text-sm text-muted">{t('intro')}</p>

      <FormErrors messages={errors} />

      <CreateForm onCreated={reload} onError={(text) => setErrors([text])} existing={visible} />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-text">{t('listTitle')}</h2>
        <label className="ml-auto flex items-center gap-2 text-sm font-medium text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => {
              setRows(null);
              setLoadFailed(false);
              setShowArchived(event.target.checked);
            }}
            className="h-4 w-4 accent-primary"
          />
          {t('showArchived')}
        </label>
      </div>

      {changed.length > 0 ? (
        <div className="sticky top-16 z-20 mt-3 flex flex-wrap items-center gap-3 rounded-card border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-sm font-semibold text-text">{t('unsaved', { count: changed.length })}</p>
          <div className="ml-auto flex gap-2">
            <Button className="h-9" disabled={saving} onClick={() => void saveStaged()}>
              {saving ? t('saving') : t('saveChanges')}
            </Button>
            <Button variant="ghost" className="h-9" disabled={saving} onClick={() => setStaged({})}>
              {t('discard')}
            </Button>
          </div>
        </div>
      ) : null}

      {loadFailed ? (
        <div className="mt-4 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          <p role="alert">{t('loadError')}</p>
          <Button variant="secondary" className="mt-2 h-9" onClick={reload}>
            {tCommon('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <div className="mt-4 h-24" aria-busy="true" />
      ) : (
        <>
          <section aria-labelledby="cat-active" className="mt-5">
            <h3 id="cat-active" className="text-sm font-bold uppercase tracking-wider text-muted">
              {t('sectionActive', { count: activeRows.length })}
            </h3>
            {list(activeRows, t('empty'))}
          </section>

          {showArchived ? (
            <section aria-labelledby="cat-archived" className="mt-8">
              <h3 id="cat-archived" className="text-sm font-bold uppercase tracking-wider text-muted">
                {t('sectionArchived', { count: archivedRows.length })}
              </h3>
              {list(archivedRows, t('archivedEmpty'))}
            </section>
          ) : null}
        </>
      )}

      {toArchive ? (
        <ConfirmArchive
          name={toArchive.nameEn}
          productCount={toArchive.productCount}
          onConfirm={() => void confirmArchive()}
          onCancel={() => setToArchive(null)}
        />
      ) : null}
    </div>
  );
}

/** Asked before archiving, because archiving takes a category out of the list and its listings out of the shop. */
function ConfirmArchive({
  name,
  productCount,
  onConfirm,
  onCancel,
}: {
  name: string;
  productCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('AdminCategories');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t('confirmArchiveNo')} onClick={onCancel} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        className="relative w-full max-w-md rounded-card border border-border bg-card p-6 shadow-lg"
      >
        <h2 id="archive-title" className="text-lg font-bold text-text">
          {t('confirmArchiveTitle', { name })}
        </h2>
        <p className="mt-2 text-sm text-muted">{t('confirmArchiveBody')}</p>
        {productCount > 0 ? (
          <p className="mt-2 text-sm text-warning">{t('hiddenWarning', { count: productCount })}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="h-10" onClick={onCancel}>
            {t('confirmArchiveNo')}
          </Button>
          <Button className="h-10" onClick={onConfirm}>
            {t('confirmArchiveYes')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  busy,
  inShop,
  dirty,
  onToggleInShop,
  onArchive,
  onRestore,
  onSaveLabels,
}: {
  row: AdminProductCategoryView;
  busy: boolean;
  /** What the tick shows: the staged value when there is one, otherwise what the server holds. */
  inShop: boolean;
  dirty: boolean;
  onToggleInShop: (next: boolean) => void;
  onArchive: () => void;
  onRestore: () => void;
  onSaveLabels: (body: ProductCategoryUpdateInput) => void;
}) {
  const t = useTranslations('AdminCategories');
  const archived = row.archivedAt !== null;

  return (
    <li
      className={`rounded-card border bg-card p-4 shadow-sm ${
        dirty ? 'border-warning/60' : archived ? 'border-border opacity-70' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-text">{row.nameEn}</h4>
            <code className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">{row.slug}</code>
            {archived ? null : !row.active ? (
              <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                {t('badgeOff')}
              </span>
            ) : null}
            {dirty ? (
              <span className="rounded-full border border-warning/60 bg-warning/20 px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                {inShop ? t('pendingOn') : t('pendingOff')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {row.nameId} · {row.nameRu} · {t('productCount', { count: row.productCount })}
          </p>
          {!archived && !row.active && row.productCount > 0 ? (
            <p className="mt-1.5 text-sm text-warning">{t('hiddenWarning', { count: row.productCount })}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {archived ? (
            <Button variant="secondary" className="h-9" disabled={busy} onClick={onRestore}>
              {t('restore')}
            </Button>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm font-semibold text-text">
                <input
                  type="checkbox"
                  checked={inShop}
                  disabled={busy}
                  onChange={(event) => onToggleInShop(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                {t('inShop')}
              </label>
              <Button variant="secondary" className="h-9" disabled={busy} onClick={onArchive}>
                {t('archive')}
              </Button>
            </>
          )}
        </div>
      </div>

      <EditLabels row={row} busy={busy} onSave={onSaveLabels} />
    </li>
  );
}

function EditLabels({
  row,
  busy,
  onSave,
}: {
  row: AdminProductCategoryView;
  busy: boolean;
  onSave: (body: ProductCategoryUpdateInput) => void;
}) {
  const t = useTranslations('AdminCategories');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-semibold text-primary hover:underline"
      >
        {t('editLabels')}
      </button>
    );
  }

  return (
    <form
      className="mt-3 border-t border-border pt-3"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          nameEn: String(form.get('nameEn')).trim(),
          nameId: String(form.get('nameId')).trim(),
          nameRu: String(form.get('nameRu')).trim(),
          sortOrder: Number(form.get('sortOrder')),
        });
        setOpen(false);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`en-${row.id}`} name="nameEn" label={t('nameEn')} required defaultValue={row.nameEn} maxLength={CATEGORY_LIMITS.nameMax} />
        <Field id={`id-${row.id}`} name="nameId" label={t('nameId')} required defaultValue={row.nameId} maxLength={CATEGORY_LIMITS.nameMax} />
        <Field id={`ru-${row.id}`} name="nameRu" label={t('nameRu')} required defaultValue={row.nameRu} maxLength={CATEGORY_LIMITS.nameMax} />
        <Field
          id={`sort-${row.id}`}
          name="sortOrder"
          label={t('sortOrder')}
          helper={t('sortOrderHelper')}
          type="number"
          min={0}
          max={CATEGORY_LIMITS.sortOrderMax}
          defaultValue={String(row.sortOrder)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="submit" className="h-9" disabled={busy}>
          {t('save')}
        </Button>
        <Button type="button" variant="ghost" className="h-9" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

function CreateForm({
  onCreated,
  onError,
  existing,
}: {
  onCreated: () => void;
  onError: (message: string) => void;
  existing: AdminProductCategoryView[];
}) {
  const t = useTranslations('AdminCategories');
  const tErrors = useTranslations('Errors');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button className="mt-5 h-10" onClick={() => setOpen(true)}>
        {t('addButton')}
      </Button>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slug = String(form.get('slug')).trim().toUpperCase().replace(/\s+/g, '_');
    const body: ProductCategoryCreateInput = {
      slug,
      nameEn: String(form.get('nameEn')).trim(),
      nameId: String(form.get('nameId')).trim(),
      nameRu: String(form.get('nameRu')).trim(),
    };
    setBusy(true);
    try {
      await apiFetch<AdminProductCategoryView>('/admin/categories', { method: 'POST', body });
      setOpen(false);
      onCreated();
    } catch (error) {
      onError(message(error, tErrors));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-5 rounded-card border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-bold text-text">{t('addTitle')}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          id="new-slug"
          name="slug"
          label={t('slug')}
          helper={t('slugHelper', { example: existing[0]?.slug ?? 'COFFEE_TEA' })}
          required
          maxLength={CATEGORY_LIMITS.slugMax}
        />
        <Field id="new-en" name="nameEn" label={t('nameEn')} required maxLength={CATEGORY_LIMITS.nameMax} />
        <Field id="new-id" name="nameId" label={t('nameId')} required maxLength={CATEGORY_LIMITS.nameMax} />
        <Field id="new-ru" name="nameRu" label={t('nameRu')} required maxLength={CATEGORY_LIMITS.nameMax} />
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" className="h-10" disabled={busy}>
          {t('create')}
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

/**
 * The API's 409s carry the useful part (which slug already exists, and whether it is archived rather than
 * live), so they are shown as they come instead of being flattened into a generic message.
 */
function message(error: unknown, tErrors: (key: string) => string): string {
  if (error instanceof ApiError && error.status === 409 && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return tErrors(errorKey(error));
}
