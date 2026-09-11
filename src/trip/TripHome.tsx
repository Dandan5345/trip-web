import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../i18n/I18nProvider';
import { useSession } from '../session/SessionProvider';
import { EmptyState, Notice, Skeleton } from '../ui/primitives';
import { useWeather, weatherEmoji } from '../weather/useWeather';
import { LogisticsCard } from './components/LogisticsCard';
import { EditTripModal } from './modals/EditTripModal';
import { LogisticsDetailModal } from './modals/LogisticsDetailModal';
import { WeatherModal } from './modals/WeatherModal';
import {
  calendarDaysUntil,
  formatDateSpan,
  formatShortDate,
  formatWeekday,
  nightsBetween,
} from './format';
import { TRIP_SECTIONS } from './sections';
import type { LogisticsItem, TripSnapshot } from './model';
import { useTrip, useTripWriter } from './useTrip';
import './trip.css';

/**
 * The desktop version of the app's trip home screen.
 *
 * Same content, laid out for a wide screen instead of a scaled-up phone:
 * the hero and its facts, the destination chips, every section as a real
 * link, the next items on the schedule, and the logistics grouped the way
 * the app groups them.
 */
export function TripHome() {
  const { state, trip } = useTrip();
  const { t } = useI18n();

  if (state === 'loading') return <TripHomeSkeleton />;
  if (state === 'missing' || state === 'denied') {
    return (
      <div className="te-content__inner">
        <EmptyState title={t('tripMissingTitle')} body={t('tripMissingBody')} />
      </div>
    );
  }
  if (state === 'error' || !trip) {
    return (
      <div className="te-content__inner">
        <EmptyState title={t('errorTitle')} />
      </div>
    );
  }

  return <TripHomeContent trip={trip} />;
}

function TripHomeContent({ trip }: { trip: TripSnapshot }) {
  const { t, locale } = useI18n();
  const { canEdit } = useTripWriter();
  const { active } = useSession();

  const [openItem, setOpenItem] = useState<LogisticsItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);

  const { header, logistics, schedule, counts } = trip;
  const firstDestination = header.destinations.find((d) => d.lat != null && d.lon != null);
  const weather = useWeather(
    firstDestination?.lat,
    firstDestination?.lon,
    firstDestination?.name ?? header.name,
  );

  const daysLeft = calendarDaysUntil(header.startDate);
  const nights = nightsBetween(header.startDate, header.endDate);

  const groups = useMemo(() => groupLogistics(logistics), [logistics]);
  const upcoming = useMemo(() => nextScheduleEntries(schedule.entries), [schedule.entries]);

  return (
    <div className="te-content__inner te-enter">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="te-hero">
        <div>
          <h1 className="te-hero__title">{header.name}</h1>

          <div className="te-hero__meta">
            <span className="te-pill">
              <span aria-hidden="true">✈️</span>
              {formatDateSpan(header.startDate, header.endDate, locale) || t('noDates')}
            </span>

            {daysLeft != null ? (
              <span className="te-pill te-hero__countdown">
                {daysLeft > 0
                  ? t('daysUntil', { n: daysLeft })
                  : daysLeft === 0
                    ? t('tripToday')
                    : t('tripStarted')}
              </span>
            ) : null}

            {nights ? (
              <span className="te-pill">
                <span aria-hidden="true">🌙</span>
                {nights} {t('nights')}
              </span>
            ) : null}

            {header.travelerCount ? (
              <span className="te-pill">
                <span aria-hidden="true">🧳</span>
                {header.travelerCount} {t('travelers')}
              </span>
            ) : null}

            {weather.status === 'ready' ? (
              <button
                type="button"
                className="te-pill"
                onClick={() => setWeatherOpen(true)}
                aria-haspopup="dialog"
              >
                <span aria-hidden="true">{weatherEmoji(weather.data.currentCode)}</span>
                {weather.data.currentTemperature != null
                  ? `${Math.round(weather.data.currentTemperature)}°`
                  : t('weather')}
              </button>
            ) : null}

            {canEdit ? (
              <button type="button" className="te-pill" onClick={() => setEditing(true)}>
                <span aria-hidden="true">✏️</span>
                {t('editTrip')}
              </button>
            ) : (
              <span className="te-pill">{t('readOnly')}</span>
            )}
          </div>

          {header.description ? <p className="te-hero__description">{header.description}</p> : null}

          {header.destinations.length > 0 ? (
            <div className="te-destinations">
              {header.destinations.map((destination, index) => (
                <span className="te-destination" key={`${destination.name}-${index}`}>
                  <span aria-hidden="true">📍</span>
                  {destination.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {header.imageUrl ? (
          <figure style={{ margin: 0 }}>
            <img className="te-hero__image" src={header.imageUrl} alt="" />
            {header.imagePhotographerName ? (
              <figcaption className="te-hero__credit">
                {header.imagePhotographerName}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </section>

      {/* ── Locked / permissions notices ─────────────── */}
      {trip.hasLockedContent && active?.canViewSensitive === false ? (
        <div style={{ marginTop: 20 }}>
          <Notice tone="warning" title={t('encryptedTitle')}>
            {t('encryptedBody')}
          </Notice>
        </div>
      ) : null}

      {/* ── Sections ─────────────────────────────────── */}
      <nav className="te-section-grid" aria-label={t('navHome')}>
        {TRIP_SECTIONS.map((section) => {
          const count = section.count(counts);
          return (
            <Link className="te-section-card" to={section.path} key={section.id}>
              <span
                className="te-section-card__icon"
                style={{ background: `color-mix(in srgb, ${section.color} 16%, transparent)` }}
                aria-hidden="true"
              >
                {section.icon}
              </span>
              <span className="te-section-card__label">{t(section.labelKey)}</span>
              <span className="te-section-card__count">
                {count == null ? ' ' : count}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── Next up ──────────────────────────────────── */}
      <section className="te-block">
        <div className="te-block__head">
          <h2 className="te-block__title">{t('sectionNextUp')}</h2>
          <span className="te-block__count">{counts.scheduleItems}</span>
          <Link className="te-block__action" to="schedule">
            {t('viewAll')}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState title={t('emptySchedule')} />
        ) : (
          <div className="te-timeline">
            {upcoming.map((entry) => (
              <div className="te-timeline__row" key={entry.id}>
                <div className="te-timeline__time">{entry.startTime ?? '—'}</div>
                <div>
                  <div className="te-timeline__title">{entry.title}</div>
                  <div className="te-timeline__meta">
                    {[
                      entry.date ? formatWeekday(entry.date, locale) : null,
                      entry.date ? formatShortDate(entry.date, locale) : null,
                      entry.address,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Logistics, grouped as the app groups them ── */}
      {groups.length === 0 ? (
        <section className="te-block">
          <div className="te-block__head">
            <h2 className="te-block__title">{t('navLogistics')}</h2>
          </div>
          <EmptyState title={t('emptyLogistics')} />
        </section>
      ) : (
        groups.map((group) => (
          <section className="te-block" key={group.id}>
            <div className="te-block__head">
              <h2 className="te-block__title">{t(group.titleKey)}</h2>
              <span className="te-block__count">{group.items.length}</span>
              <Link className="te-block__action" to="logistics">
                {t('viewAll')}
              </Link>
            </div>
            <div className="te-cards">
              {group.items.map((item) => (
                <LogisticsCard key={item.id} item={item} onOpen={setOpenItem} />
              ))}
            </div>
          </section>
        ))
      )}

      {openItem ? (
        <LogisticsDetailModal item={openItem} onClose={() => setOpenItem(null)} />
      ) : null}
      {editing ? (
        <EditTripModal
          header={header}
          storedTripData={(trip.raw.tripData ?? {}) as Record<string, unknown>}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {weatherOpen ? <WeatherModal state={weather} onClose={() => setWeatherOpen(false)} /> : null}
    </div>
  );
}

// ── Grouping, mirroring the app's home-screen sections ───

const GROUP_ORDER = [
  { id: 'hotel', titleKey: 'sectionHotels' },
  { id: 'flight', titleKey: 'sectionFlights' },
  { id: 'carRental', titleKey: 'sectionCars' },
  { id: 'ride', titleKey: 'sectionRides' },
  { id: 'train', titleKey: 'sectionTrains' },
  { id: 'ferry', titleKey: 'sectionFerries' },
  { id: 'cruise', titleKey: 'sectionCruises' },
] as const;

function groupLogistics(items: LogisticsItem[]) {
  return GROUP_ORDER.map((group) => ({
    id: group.id,
    titleKey: group.titleKey,
    items: items
      .filter((item) =>
        group.id === 'hotel' ? item.mainType === 'hotel' : item.subType === group.id,
      )
      .sort((left, right) => (left.start?.getTime() ?? 0) - (right.start?.getTime() ?? 0)),
  })).filter((group) => group.items.length > 0);
}

function nextScheduleEntries(entries: TripSnapshot['schedule']['entries']) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = entries.filter((entry) => !entry.date || entry.date >= today);
  return (future.length > 0 ? future : entries).slice(0, 4);
}

function TripHomeSkeleton() {
  return (
    <div className="te-content__inner">
      <div className="te-hero">
        <div style={{ display: 'grid', gap: 14 }}>
          <Skeleton width="60%" height={38} />
          <Skeleton width="82%" height={20} />
          <Skeleton width="40%" height={20} />
        </div>
        <Skeleton height={168} />
      </div>
      <div className="te-section-grid">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} height={104} />
        ))}
      </div>
      <div className="te-block">
        <Skeleton width={180} height={24} />
        <div className="te-cards" style={{ marginTop: 14 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} height={220} />
          ))}
        </div>
      </div>
    </div>
  );
}
