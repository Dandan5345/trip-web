import { useState } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from '../../ui/Modal';
import { Notice } from '../../ui/primitives';
import { TripConflictError, useTripWriter } from '../useTrip';
import { fromDateInputValue, toDateInputValue } from '../format';
import type { TripHeader } from '../model';

/**
 * The one edit the desktop home screen offers today: the trip's own details.
 *
 * It writes through dotted field paths, so only the changed keys of
 * `tripData` move; the rest of the document — places, logistics, schedule —
 * is never rewritten by a name change.
 */
export function EditTripModal({
  header,
  storedTripData,
  onClose,
}: {
  header: TripHeader;
  /**
   * The raw `tripData` map as Firestore holds it. Conflict detection compares
   * against these exact values — re-serialising the parsed Date would never
   * match what the app wrote, and every save would look like a change.
   */
  storedTripData: Record<string, unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { saveTripFields } = useTripWriter();

  const [name, setName] = useState(header.name);
  const [description, setDescription] = useState(header.description ?? '');
  const [startDate, setStartDate] = useState(toDateInputValue(header.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(header.endDate));
  const [travelers, setTravelers] = useState(
    header.travelerCount == null ? '' : String(header.travelerCount),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<TripConflictError | null>(null);

  const baseline: Record<string, unknown> = {
    name: storedTripData.name ?? null,
    description: storedTripData.description ?? null,
    startDate: storedTripData.startDate ?? null,
    endDate: storedTripData.endDate ?? null,
    travelerCount: storedTripData.travelerCount ?? null,
  };

  function buildPatch(): Record<string, unknown> {
    const travelerCount = travelers.trim() === '' ? null : Number(travelers);
    const next: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      startDate: fromDateInputValue(startDate),
      endDate: fromDateInputValue(endDate),
      travelerCount: Number.isFinite(travelerCount) ? travelerCount : null,
    };
    // Only send what actually changed — a no-op save should write nothing.
    return Object.fromEntries(
      Object.entries(next).filter(([field, value]) => !sameScalar(value, baseline[field])),
    );
  }

  async function save(force = false) {
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveTripFields(patch, baseline, { force });
      onClose();
    } catch (caught) {
      if (caught instanceof TripConflictError) {
        setConflict(caught);
      } else {
        setError(t('saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  if (conflict) {
    return (
      <Modal title={t('conflictTitle')} onClose={onClose}>
        <Notice tone="warning">{t('conflictBody')}</Notice>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="te-button"
            disabled={saving}
            onClick={() => {
              setConflict(null);
              void save(true);
            }}
          >
            {t('conflictKeepMine')}
          </button>
          <button type="button" className="te-button te-button--ghost" onClick={onClose}>
            {t('conflictKeepTheirs')}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('editTrip')}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="te-button te-button--ghost"
            onClick={onClose}
            disabled={saving}
          >
            {t('cancel')}
          </button>
          <button type="button" className="te-button" onClick={() => void save()} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </>
      }
    >
      <form onSubmit={(event) => event.preventDefault()}>
        <label className="te-field">
          <span className="te-field__label">{t('fieldName')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </label>

        <div className="te-field-row">
          <label className="te-field">
            <span className="te-field__label">{t('fieldStartDate')}</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="te-field">
            <span className="te-field__label">{t('fieldEndDate')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>

        <label className="te-field">
          <span className="te-field__label">{t('fieldTravelers')}</span>
          <input
            type="number"
            min={1}
            max={99}
            value={travelers}
            onChange={(event) => setTravelers(event.target.value)}
          />
        </label>

        <label className="te-field">
          <span className="te-field__label">{t('fieldDescription')}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1200}
          />
        </label>

        {error ? <Notice tone="warning">{error}</Notice> : null}
      </form>
    </Modal>
  );
}

function sameScalar(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null && right == null) return true;
  // The app writes travelerCount as a num; a form gives back a JS number.
  if (typeof left === 'number' && typeof right === 'number') return left === right;
  return false;
}
