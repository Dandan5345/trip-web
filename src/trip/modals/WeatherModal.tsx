import { useI18n } from '../../i18n/I18nProvider';
import { Modal } from '../../ui/Modal';
import { EmptyState, Spinner } from '../../ui/primitives';
import { weatherEmoji } from '../../weather/useWeather';
import type { WeatherSnapshot } from '../../weather/useWeather';

export function WeatherModal({
  state,
  onClose,
}: {
  state: { status: 'idle' | 'loading' } | { status: 'ready'; data: WeatherSnapshot } | { status: 'error' };
  onClose: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <Modal
      title={t('weather')}
      subtitle={state.status === 'ready' ? state.data.locationName : undefined}
      onClose={onClose}
      footer={
        <button type="button" className="te-button te-button--ghost" onClick={onClose}>
          {t('close')}
        </button>
      }
    >
      {state.status === 'loading' || state.status === 'idle' ? <Spinner /> : null}
      {state.status === 'error' ? <EmptyState title={t('weatherUnavailable')} /> : null}
      {state.status === 'ready' ? (
        <div className="te-timeline">
          {state.data.days.map((day) => (
            <div className="te-timeline__row" key={day.date}>
              <div className="te-timeline__time" aria-hidden="true" style={{ fontSize: 22 }}>
                {weatherEmoji(day.code)}
              </div>
              <div>
                <div className="te-timeline__title">
                  {new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(`${day.date}T12:00:00`))}
                </div>
                <div className="te-timeline__meta">
                  {day.max != null ? `${Math.round(day.max)}°` : '—'}
                  {' / '}
                  {day.min != null ? `${Math.round(day.min)}°` : '—'}
                  {day.precipitation ? ` · ${day.precipitation} mm` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
