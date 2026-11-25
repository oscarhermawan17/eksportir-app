'use client';

import { CATEGORY_ICON_NAMES, type CategoryIconName } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { CategoryIcon } from '@/components/catalog/category-icon';

const OPTION =
  'flex h-10 w-10 cursor-pointer items-center justify-center rounded-button border border-border bg-card text-muted transition-colors hover:border-border-strong hover:text-text has-checked:border-primary has-checked:bg-surface has-checked:text-primary has-checked:ring-1 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary';

/**
 * A row of radio buttons, one per allowed icon plus "Default". Plain form radios named `icon`, so the forms that
 * hold it read the choice with FormData like their other fields; `iconFromForm` turns "" into null.
 * Each option has its name as an accessible label and a tooltip, since the picture alone is not enough.
 */
export function IconPicker({ idPrefix, defaultValue }: { idPrefix: string; defaultValue: CategoryIconName | null }) {
  const t = useTranslations('AdminCategories');

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-medium text-text">{t('icon')}</legend>
      <p className="mt-0.5 text-xs text-muted">{t('iconHelper')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className={`${OPTION} w-auto px-3 text-sm`} title={t('iconDefault')}>
          <input type="radio" name="icon" value="" defaultChecked={defaultValue === null} className="sr-only" />
          <CategoryIcon name={null} />
          <span className="ml-1.5">{t('iconDefault')}</span>
        </label>
        {CATEGORY_ICON_NAMES.map((name) => (
          <label key={name} htmlFor={`${idPrefix}-${name}`} className={OPTION} title={t(`iconNames.${name}`)}>
            <input
              id={`${idPrefix}-${name}`}
              type="radio"
              name="icon"
              value={name}
              defaultChecked={defaultValue === name}
              aria-label={t(`iconNames.${name}`)}
              className="sr-only"
            />
            <CategoryIcon name={name} className="h-5 w-5" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The picker's value from a submitted form: a listed name, or null for the default icon. */
export function iconFromForm(form: FormData): CategoryIconName | null {
  const value = String(form.get('icon') ?? '');
  return (CATEGORY_ICON_NAMES as readonly string[]).includes(value) ? (value as CategoryIconName) : null;
}
