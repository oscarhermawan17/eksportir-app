'use client';

import type { QcZoneOption, SellerProfileView } from '@balitrade/shared';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormErrors, SelectField, TextareaField } from '@/components/ui/field';
import { apiFetch, errorKey } from '@/lib/api';

/** Apply to become a seller (no profile yet) or edit the existing profile. */
export function SellerForm({
  zones,
  profile,
  defaultName,
  onSaved,
}: {
  zones: QcZoneOption[];
  profile: SellerProfileView | null;
  defaultName: string;
  onSaved: (profile: SellerProfileView) => void;
}) {
  const t = useTranslations('Seller');
  const tErrors = useTranslations('Errors');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  // An approved seller cannot move to another zone (it drives the QC fee) — the API enforces this too.
  const zoneLocked = profile?.status === 'APPROVED' && profile.qcZone !== null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const qcZoneId = String(form.get('qcZoneId') ?? '');
    const body = {
      displayName: String(form.get('displayName')),
      about: String(form.get('about') ?? ''),
      ...(qcZoneId && !zoneLocked ? { qcZoneId } : {}),
    };
    setSubmitting(true);
    setSaved(false);
    setErrors([]);
    try {
      const result = profile
        ? await apiFetch<SellerProfileView>('/sellers/me', { method: 'PATCH', body })
        : await apiFetch<SellerProfileView>('/sellers/apply', { method: 'POST', body });
      onSaved(result);
      setSaved(true);
    } catch (error) {
      setErrors([tErrors(errorKey(error))]);
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = !profile
    ? submitting
      ? t('submitting')
      : t('submitApply')
    : submitting
      ? t('saving')
      : profile.status === 'REJECTED'
        ? t('resubmit')
        : t('save');

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormErrors messages={errors} />
      <Field
        id="displayName"
        name="displayName"
        label={t('displayName')}
        helper={t('displayNameHelper')}
        required
        minLength={2}
        maxLength={100}
        defaultValue={profile?.displayName ?? defaultName}
      />
      <SelectField
        id="qcZoneId"
        name="qcZoneId"
        label={t('location')}
        helper={zoneLocked ? t('locationLocked') : t('locationHelper')}
        placeholder={t('locationPlaceholder')}
        options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
        defaultValue={profile?.qcZone?.id ?? ''}
        disabled={zoneLocked}
      />
      <TextareaField id="about" name="about" label={t('about')} maxLength={1000} defaultValue={profile?.about ?? ''} />
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-success">
            {t('saved')}
          </p>
        ) : null}
      </div>
    </form>
  );
}
