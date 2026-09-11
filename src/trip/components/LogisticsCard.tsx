import { useI18n } from '../../i18n/I18nProvider';
import { LockedBadge } from '../../ui/primitives';
import { formatMoney, formatShortDate } from '../format';
import type { LogisticsItem } from '../model';
import { logisticsIcon } from './logisticsIcon';

export function LogisticsCard({
  item,
  onOpen,
}: {
  item: LogisticsItem;
  onOpen: (item: LogisticsItem) => void;
}) {
  const { t, locale } = useI18n();
  const price = formatMoney(item.totalPrice, item.currencyCode, locale);
  const dates = [item.start, item.end]
    .filter((value): value is Date => value !== null)
    .map((value) => formatShortDate(value, locale));
  const dateLabel = dates.length === 2 && dates[0] !== dates[1] ? dates.join(' – ') : dates[0];

  return (
    <button
      type="button"
      className="te-item-card"
      onClick={() => onOpen(item)}
      aria-label={`${item.title || t('details')} — ${t('details')}`}
    >
      {item.imageUrl ? (
        <img className="te-item-card__image" src={item.imageUrl} alt="" loading="lazy" />
      ) : (
        <div className="te-item-card__image te-item-card__image--placeholder" aria-hidden="true">
          {logisticsIcon(item)}
        </div>
      )}
      <div className="te-item-card__body">
        <div className="te-item-card__title">{item.title || t('details')}</div>
        {item.subtitle ? <div className="te-item-card__subtitle">{item.subtitle}</div> : null}
        <div className="te-item-card__row">
          {dateLabel ? <span>{dateLabel}</span> : null}
          {price ? <span className="te-item-card__price">{price}</span> : null}
          {item.paymentStatus ? <PaymentBadge status={item.paymentStatus} /> : null}
          {item.locked ? <LockedBadge /> : null}
        </div>
      </div>
    </button>
  );
}

function PaymentBadge({ status }: { status: NonNullable<LogisticsItem['paymentStatus']> }) {
  const { t } = useI18n();
  if (status === 'fullyPaid') {
    return <span className="te-badge te-badge--paid">{t('paid')}</span>;
  }
  if (status === 'partiallyPaid') {
    return <span className="te-badge te-badge--locked">{t('partiallyPaid')}</span>;
  }
  return <span className="te-badge te-badge--unpaid">{t('notPaid')}</span>;
}
