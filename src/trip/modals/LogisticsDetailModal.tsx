import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from '../../ui/Modal';
import { LockedBadge, Notice, PhoneOnlyBadge } from '../../ui/primitives';
import { logisticsIcon } from '../components/logisticsIcon';
import { asNumber, asString } from '../model';
import type { LogisticsItem } from '../model';
import { formatDate, formatMoney } from '../format';
import type { StringKey } from '../../i18n/strings';

/**
 * The full detail sheet the app opens from a home-screen card
 * (`_showDetailSheet` in trip_dashboard_screen.dart), rebuilt for a wide
 * screen. Sensitive fields this session cannot decrypt are shown as locked,
 * never as broken text.
 */
export function LogisticsDetailModal({
  item,
  onClose,
}: {
  item: LogisticsItem;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const raw = item.raw;

  const rows = useDetailRows(item);
  const notes = item.locked ? null : asString(raw.notes);
  const bookingLink = item.locked ? null : asString(raw.bookingLink);
  const price = formatMoney(item.totalPrice, item.currencyCode, locale);

  return (
    <Modal
      title={`${logisticsIcon(item)}  ${item.title || t('details')}`}
      subtitle={item.subtitle || undefined}
      onClose={onClose}
      footer={
        <button type="button" className="te-button te-button--ghost" onClick={onClose}>
          {t('close')}
        </button>
      }
    >
      {item.locked ? (
        <div style={{ marginBottom: 18 }}>
          <Notice tone="warning" title={t('encryptedTitle')}>
            {t('encryptedBody')}
          </Notice>
        </div>
      ) : null}

      <div className="te-detail-grid">
        {rows.map((row) => (
          <div className="te-detail" key={row.label}>
            <div className="te-detail__label">{row.label}</div>
            <div className="te-detail__value">{row.value}</div>
          </div>
        ))}
        {price ? (
          <div className="te-detail">
            <div className="te-detail__label">{t('price')}</div>
            <div className="te-detail__value">{price}</div>
          </div>
        ) : item.locked ? (
          <div className="te-detail">
            <div className="te-detail__label">{t('price')}</div>
            <div className="te-detail__value">
              <LockedBadge />
            </div>
          </div>
        ) : null}
      </div>

      {notes ? (
        <div style={{ marginTop: 22 }}>
          <div className="te-detail__label">{t('notes')}</div>
          <p style={{ marginTop: 6, fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {notes}
          </p>
        </div>
      ) : null}

      {bookingLink ? (
        <div style={{ marginTop: 22 }}>
          <a
            className="te-button te-button--ghost"
            href={bookingLink}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('bookingLink')} ↗
          </a>
        </div>
      ) : null}

      {item.hasPhoneOnlyAttachments ? (
        <div style={{ marginTop: 22 }}>
          <Notice title={t('phoneOnlyTitle')}>
            {t('attachmentsPhoneOnly')} <PhoneOnlyBadge />
          </Notice>
        </div>
      ) : null}
    </Modal>
  );
}

interface DetailRow {
  label: string;
  value: string;
}

/** The per-subtype rows the app shows in its own detail sheet. */
function useDetailRows(item: LogisticsItem): DetailRow[] {
  const { t, locale } = useI18n();
  const raw = item.raw;
  const rows: DetailRow[] = [];

  const push = (key: StringKey, value: string | null | undefined) => {
    if (value) rows.push({ label: t(key), value });
  };
  const pushRaw = (label: string, value: string | null | undefined) => {
    if (value) rows.push({ label, value });
  };

  if (item.mainType === 'hotel') {
    push('checkIn', item.start ? formatDate(item.start, locale) : null);
    push('checkOut', item.end ? formatDate(item.end, locale) : null);
    push('address', item.locked ? null : asString(raw.address));
    pushRaw('★', starsOf(raw));
  } else {
    switch (item.subType) {
      case 'flight':
        push('departure', joinTime(asString(raw.departureAirport), asString(raw.departureTime)));
        push('arrival', joinTime(asString(raw.arrivalAirport), asString(raw.arrivalTime)));
        push('seat', item.locked ? null : asString(raw.seatNumbers));
        push('seatClass', item.locked ? null : asString(raw.seatClass));
        push('passengers', numberText(raw.passengers));
        break;
      case 'carRental':
        push('pickup', joinTime(asString(raw.pickupLocation), asString(raw.pickupTime)));
        push('dropoff', joinTime(asString(raw.returnLocation), asString(raw.returnTime)));
        push('passengers', numberText(raw.passengers));
        break;
      case 'ride':
        push('pickup', joinTime(asString(raw.fromAddress), asString(raw.pickupTime)));
        push('dropoff', asString(raw.toAddress));
        push('passengers', numberText(raw.passengers));
        break;
      case 'train':
        push('departure', joinTime(asString(raw.fromStation), asString(raw.departureTime)));
        push('arrival', joinTime(asString(raw.toStation), asString(raw.arrivalTime)));
        push('passengers', numberText(raw.passengers));
        break;
      case 'ferry':
        push('departure', joinTime(asString(raw.fromPort), asString(raw.departureTime)));
        push('arrival', joinTime(asString(raw.toPort), asString(raw.arrivalTime)));
        push('passengers', numberText(raw.passengers));
        break;
      case 'cruise':
        push('departure', joinTime(asString(raw.departurePort), asString(raw.departureTime)));
        push('arrival', joinTime(asString(raw.arrivalPort), asString(raw.arrivalTime)));
        push('passengers', numberText(raw.passengers));
        break;
      default:
        break;
    }
  }

  // A subtype we do not have a bespoke layout for still shows its dates
  // rather than an empty sheet.
  if (rows.length === 0 && item.start) {
    push('departure', formatDate(item.start, locale));
    if (item.end) push('arrival', formatDate(item.end, locale));
  }
  return rows;
}

function joinTime(place: string | null, time: string | null): string | null {
  if (!place && !time) return null;
  return [place, time].filter(Boolean).join(' · ');
}

function numberText(value: unknown): string | null {
  const parsed = asNumber(value);
  return parsed == null ? null : String(parsed);
}

function starsOf(raw: Record<string, unknown>): string | null {
  const stars = asNumber(raw.starRating);
  return stars == null ? null : '★'.repeat(Math.max(0, Math.min(5, Math.round(stars))));
}
