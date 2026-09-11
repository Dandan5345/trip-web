import type { StringKey } from '../i18n/strings';
import type { TripCounts } from './model';

/**
 * The trip's sections, in the same order and with the same colours as
 * `TripSectionNav` in the app. Each one is a real route; the ones that are not
 * built yet render a placeholder rather than a dead end.
 */
export interface TripSection {
  id: string;
  path: string;
  labelKey: StringKey;
  icon: string;
  color: string;
  count: (counts: TripCounts) => number | null;
  /** False while the section is still a placeholder page. */
  built: boolean;
}

export const TRIP_SECTIONS: TripSection[] = [
  {
    id: 'expenses',
    path: 'expenses',
    labelKey: 'navExpenses',
    icon: '💳',
    color: 'var(--te-section-expenses)',
    count: () => null,
    built: false,
  },
  {
    id: 'documents',
    path: 'documents',
    labelKey: 'navDocuments',
    icon: '🗂️',
    color: 'var(--te-section-docs)',
    count: (counts) => counts.documents + counts.checklists + counts.notes,
    built: false,
  },
  {
    id: 'places',
    path: 'places',
    labelKey: 'navPlaces',
    icon: '⭐',
    color: 'var(--te-section-places)',
    count: (counts) => counts.places,
    built: false,
  },
  {
    id: 'logistics',
    path: 'logistics',
    labelKey: 'navLogistics',
    icon: '🏨',
    color: 'var(--te-section-hotels)',
    count: (counts) => counts.logistics,
    built: false,
  },
  {
    id: 'bookings',
    path: 'bookings',
    labelKey: 'navBookings',
    icon: '🧾',
    color: 'var(--te-section-bookings)',
    count: (counts) => counts.bookings,
    built: false,
  },
  {
    id: 'schedule',
    path: 'schedule',
    labelKey: 'navSchedule',
    icon: '🗓️',
    color: 'var(--te-section-schedule)',
    count: (counts) => counts.scheduleItems,
    built: false,
  },
  {
    id: 'map',
    path: 'map',
    labelKey: 'navMap',
    icon: '🗺️',
    color: 'var(--te-accent)',
    count: () => null,
    built: false,
  },
];

export function findSection(path: string): TripSection | undefined {
  return TRIP_SECTIONS.find((section) => section.path === path);
}
