/**
 * The shape of `shared_trips/{tripId}`, as written by the Flutter app.
 *
 * This is the app's own schema — the web client reads and writes the same
 * document, it does not keep a third source of truth. Parsing is deliberately
 * forgiving: a field the app has not written yet must render as "empty", never
 * as a crash.
 */
import type { Json } from './sensitivity';

export type PaymentStatus = 'unpaid' | 'fullyPaid' | 'partiallyPaid';

export interface TripDestination {
  name: string;
  lat: number | null;
  lon: number | null;
  address: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface TripHeader {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  destinations: TripDestination[];
  imageUrl: string | null;
  imagePhotographerName: string | null;
  imagePhotographerUsername: string | null;
  imagePixabayPageUrl: string | null;
  travelerCount: number | null;
  description: string | null;
  ownerUsername: string | null;
  shareMode: string | null;
}

export interface LogisticsItem {
  id: string;
  mainType: 'hotel' | 'transport';
  subType: string | null;
  raw: Json;
  /** True when sensitive fields are still ciphertext (no key for this session). */
  locked: boolean;
  title: string;
  subtitle: string;
  start: Date | null;
  end: Date | null;
  imageUrl: string | null;
  currencyCode: string | null;
  totalPrice: number | null;
  paymentStatus: PaymentStatus | null;
  /** True when the item references attachments that never leave the phone. */
  hasPhoneOnlyAttachments: boolean;
}

export interface ScheduleDay {
  dateKey: string;
  dayTitle: string | null;
  date: Date | null;
  destination: string | null;
}

export interface ScheduleEntry {
  id: string;
  dateKey: string;
  date: Date | null;
  title: string;
  summary: string | null;
  startTime: string | null;
  endTime: string | null;
  address: string | null;
  notes: string | null;
}

export interface TripCounts {
  places: number;
  checklists: number;
  notes: number;
  documents: number;
  bookings: number;
  scheduleDays: number;
  scheduleItems: number;
  logistics: number;
}

export interface TripSnapshot {
  header: TripHeader;
  logistics: LogisticsItem[];
  schedule: { days: ScheduleDay[]; entries: ScheduleEntry[] };
  counts: TripCounts;
  /** Raw payload, kept so edits can patch precise fields. */
  raw: Json;
  updatedAt: Date | null;
  /** True when at least one item could not be decrypted with this session's key. */
  hasLockedContent: boolean;
}

// ── Primitives ──────────────────────────────────────────

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asList(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter((item): item is Json => !!item && typeof item === 'object') : [];
}

// ── Trip header ─────────────────────────────────────────

export function parseHeader(tripData: unknown, fallbackId: string): TripHeader {
  const data = (tripData && typeof tripData === 'object' ? tripData : {}) as Json;
  return {
    id: asString(data.id) ?? fallbackId,
    name: asString(data.name) ?? '',
    startDate: asDate(data.startDate),
    endDate: asDate(data.endDate),
    destinations: asList(data.destinations).map((item) => ({
      name: asString(item.name) ?? '',
      lat: asNumber(item.lat),
      lon: asNumber(item.lon),
      address: asString(item.address),
      startDate: asDate(item.startDate),
      endDate: asDate(item.endDate),
    })),
    imageUrl: asString(data.imageUrl),
    imagePhotographerName: asString(data.imagePhotographerName),
    imagePhotographerUsername: asString(data.imagePhotographerUsername),
    imagePixabayPageUrl: asString(data.imagePixabayPageUrl),
    travelerCount: asNumber(data.travelerCount),
    description: asString(data.description),
    ownerUsername: asString(data.ownerUsername),
    shareMode: asString(data.shareMode),
  };
}

// ── Logistics ───────────────────────────────────────────

const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'fullyPaid', 'partiallyPaid'];

export function parseLogistics(raw: unknown): LogisticsItem[] {
  return asList(raw).map(parseLogisticsItem).filter((item): item is LogisticsItem => item !== null);
}

function parseLogisticsItem(item: Json): LogisticsItem | null {
  const id = asString(item.id);
  if (!id) return null;
  const mainType = item.mainType === 'hotel' ? 'hotel' : 'transport';
  const subType = asString(item.subType);
  const locked = item._encrypted === true;
  const status = asString(item.paymentStatus);

  const { title, subtitle, start, end } = describeLogistics(item, mainType, subType);

  return {
    id,
    mainType,
    subType,
    raw: item,
    locked,
    title,
    subtitle,
    start,
    end,
    imageUrl: asString(item.imageUrl) ?? asString(item.bgImageUrl),
    currencyCode: asString(item.currencyCode),
    // A locked item's price is still ciphertext; showing a parsed number
    // would be a lie, so it stays null and the UI shows the lock.
    totalPrice: locked ? null : asNumber(item.totalPrice),
    paymentStatus:
      status && (PAYMENT_STATUSES as string[]).includes(status) ? (status as PaymentStatus) : null,
    hasPhoneOnlyAttachments:
      Array.isArray(item.attachments) && (item.attachments as unknown[]).length > 0,
  };
}

function describeLogistics(
  item: Json,
  mainType: 'hotel' | 'transport',
  subType: string | null,
): { title: string; subtitle: string; start: Date | null; end: Date | null } {
  if (mainType === 'hotel') {
    return {
      title: asString(item.hotelName) ?? '',
      subtitle: [asString(item.destination), asString(item.bookedVia)].filter(Boolean).join(' · '),
      start: asDate(item.checkIn),
      end: asDate(item.checkOut),
    };
  }

  switch (subType) {
    case 'flight':
      return {
        title: [asString(item.airline), asString(item.flightNumber)].filter(Boolean).join(' ') || '',
        subtitle: [asString(item.departureAirport), asString(item.arrivalAirport)]
          .filter(Boolean)
          .join(' → '),
        start: asDate(item.date),
        end: asDate(item.arrivalDate) ?? asDate(item.date),
      };
    case 'carRental':
      return {
        title: asString(item.carType) ?? asString(item.bookedVia) ?? '',
        subtitle: [asString(item.pickupLocation), asString(item.returnLocation)]
          .filter(Boolean)
          .join(' → '),
        start: asDate(item.pickupDate),
        end: asDate(item.returnDate),
      };
    case 'ride':
      return {
        title: asString(item.company) ?? asString(item.vehicleType) ?? '',
        subtitle: [asString(item.fromAddress), asString(item.toAddress)].filter(Boolean).join(' → '),
        start: asDate(item.date),
        end: asDate(item.date),
      };
    case 'train':
      return {
        title: asString(item.company) ?? '',
        subtitle: [asString(item.fromStation), asString(item.toStation)].filter(Boolean).join(' → '),
        start: asDate(item.date),
        end: asDate(item.date),
      };
    case 'ferry':
      return {
        title: asString(item.company) ?? '',
        subtitle: [asString(item.fromPort), asString(item.toPort)].filter(Boolean).join(' → '),
        start: asDate(item.date),
        end: asDate(item.date),
      };
    case 'cruise':
      return {
        title: [asString(item.cruiseLine), asString(item.shipName)].filter(Boolean).join(' · '),
        subtitle: [asString(item.departurePort), asString(item.arrivalPort)]
          .filter(Boolean)
          .join(' → '),
        start: asDate(item.departureDate),
        end: asDate(item.arrivalDate),
      };
    default:
      return { title: asString(item.name) ?? '', subtitle: '', start: null, end: null };
  }
}

// ── Schedule ────────────────────────────────────────────

export function parseSchedule(raw: unknown): { days: ScheduleDay[]; entries: ScheduleEntry[] } {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Json;
  const deleted = new Set(
    Array.isArray(data.deletedDates) ? (data.deletedDates as unknown[]).map(String) : [],
  );

  const days: ScheduleDay[] = asList(data.meta)
    .map((item) => ({
      dateKey: String(item.dateKey ?? ''),
      dayTitle: asString(item.dayTitle),
      date: asDate(item.date),
      destination: asString(item.destination),
    }))
    .filter((day) => day.dateKey !== '' && !deleted.has(day.dateKey));

  const dayByKey = new Map(days.map((day) => [day.dateKey, day]));
  const itemsByDateKey = (data.itemsByDateKey ?? {}) as Record<string, unknown>;
  const entries: ScheduleEntry[] = [];

  for (const [dateKey, list] of Object.entries(itemsByDateKey)) {
    if (deleted.has(dateKey)) continue;
    for (const item of asList(list)) {
      const id = asString(item.id);
      if (!id) continue;
      entries.push({
        id,
        dateKey,
        date: dayByKey.get(dateKey)?.date ?? dateFromKey(dateKey),
        title: asString(item.title) ?? '',
        summary: asString(item.summary),
        startTime: asString(item.startTime),
        endTime: asString(item.endTime),
        address: asString(item.address),
        notes: asString(item.notes),
      });
    }
  }

  entries.sort((left, right) => {
    const byDate = (left.date?.getTime() ?? 0) - (right.date?.getTime() ?? 0);
    if (byDate !== 0) return byDate;
    return (left.startTime ?? '').localeCompare(right.startTime ?? '');
  });

  days.sort((left, right) => (left.date?.getTime() ?? 0) - (right.date?.getTime() ?? 0));
  return { days, entries };
}

/** Schedule keys look like `2026-03-20_Paris`. */
function dateFromKey(dateKey: string): Date | null {
  const [datePart] = dateKey.split('_');
  return asDate(datePart);
}

// ── Whole document ──────────────────────────────────────

export function parseTripSnapshot(
  payload: Json,
  tripId: string,
  updatedAt: Date | null,
): TripSnapshot {
  const logistics = parseLogistics(payload.logisticsData);
  const schedule = parseSchedule(payload.scheduleData);
  const notes = asList(payload.notesData);
  const documents = asList(payload.documentsData);
  const bookings = asList(payload.bookingConfirmationsData);

  const hasLockedContent =
    logistics.some((item) => item.locked) ||
    notes.some((item) => item._encrypted === true) ||
    documents.some((item) => item._encrypted === true) ||
    bookings.some((item) => item._encrypted === true);

  return {
    header: parseHeader(payload.tripData, tripId),
    logistics,
    schedule,
    counts: {
      places: asList(payload.placesData).length,
      checklists: asList(payload.checklistsData).length,
      notes: notes.length,
      documents: documents.length,
      bookings: bookings.length,
      scheduleDays: schedule.days.length,
      scheduleItems: schedule.entries.length,
      logistics: logistics.length,
    },
    raw: payload,
    updatedAt,
    hasLockedContent,
  };
}
