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
  const [errors, setErrors] = useState<string[]>([]);

  // Resetting here rather than inside the effect: setState in an effect body is a lint error, and the
  // two callers that cause a reload are the only places that should blank the table.
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

  /** Every change goes through here so one failed request cannot leave the table showing a lie. */
  async function run(id: string, body: ProductCategoryUpdateInput): Promise<void> {
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

  async function remove(row: AdminProductCategoryView): Promise<void> {
    if (!window.confirm(t('confirmDelete', { slug: row.slug }))) return;
    setBusyId(row.id);
    setErrors([]);
    try {
      await apiFetch<void>(`/admin/categories/${row.id}`, { method: 'DELETE' });
      reload();
    } catch (error) {
      setErrors([message(error, tErrors)]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <p className="text-sm text-muted">{t('intro')}</p>

      <FormErrors messages={errors} />

      <CreateForm
        onCreated={reload}
        onError={(text) => setErrors([text])}
        existing={rows ?? []}
      />

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

      {loadFailed ? (
        <div className="mt-4 rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          <p role="alert">{t('loadError')}</p>
          <Button variant="secondary" className="mt-2 h-9" onClick={reload}>
            {tCommon('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <div className="mt-4 h-24" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-card border border-border bg-card px-5 py-8 text-center text-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onUpdate={(body) => void run(row.id, body)}
              onDelete={() => void remove(row)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  row,
  busy,
  onUpdate,
  onDelete,
}: {
  row: AdminProductCategoryView;
  busy: boolean;
  onUpdate: (body: ProductCategoryUpdateInput) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('AdminCategories');
  const archived = row.archivedAt !== null;
  const inShop = row.active && !archived;

  return (
    <li className={`rounded-card border bg-card p-4 shadow-sm ${archived ? 'border-border opacity-70' : 'border-border'}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">{row.nameEn}</h3>
            <code className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">{row.slug}</code>
            {archived ? (
              <span className="rounded-full border border-muted/30 bg-muted/10 px-2 py-0.5 text-xs font-semibold text-muted">
                {t('badgeArchived')}
              </span>
            ) : !row.active ? (
              <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
                {t('badgeOff')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {row.nameId} · {row.nameRu} · {t('productCount', { count: row.productCount })}
          </p>
          {!inShop && row.productCount > 0 ? (
            <p className="mt-1.5 text-sm text-warning">{t('hiddenWarning', { count: row.productCount })}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {archived ? (
            <Button variant="secondary" className="h-9" disabled={busy} onClick={() => onUpdate({ archived: false })}>
              {t('restore')}
            </Button>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm font-semibold text-text">
                <input
                  type="checkbox"
                  checked={row.active}
                  disabled={busy}
                  onChange={(event) => onUpdate({ active: event.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t('inShop')}
              </label>
              <Button variant="secondary" className="h-9" disabled={busy} onClick={() => onUpdate({ archived: true })}>
                {t('archive')}
              </Button>
            </>
          )}
          {/* A category with listings cannot be deleted — the database refuses it — so the button is
              only offered when nothing references it, and archiving is the answer otherwise. */}
          {row.productCount === 0 ? (
            <Button variant="ghost" className="h-9 text-error" disabled={busy} onClick={onDelete}>
              {t('delete')}
            </Button>
          ) : null}
        </div>
      </div>

      <EditLabels row={row} busy={busy} onUpdate={onUpdate} />
    </li>
  );
}

function EditLabels({
  row,
  busy,
  onUpdate,
}: {
  row: AdminProductCategoryView;
  busy: boolean;
  onUpdate: (body: ProductCategoryUpdateInput) => void;
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
        onUpdate({
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
 * The API's 409s carry the useful part (which slug clashes, how many listings block a delete), so they
 * are shown as they come instead of being flattened into a generic message.
 */
function message(error: unknown, tErrors: (key: string) => string): string {
  if (error instanceof ApiError && error.status === 409 && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return tErrors(errorKey(error));
}
