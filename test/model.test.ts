import { describe, expect, it } from 'vitest';

import { parseHeader, parseLogistics, parseSchedule, parseTripSnapshot } from '../src/trip/model';
import { calendarDaysUntil, fromDateInputValue, nightsBetween, toDateInputValue } from '../src/trip/format';
import { asDate } from '../src/trip/model';
import { PAIRING_CODE_LENGTH, createPairingCode, formatPairingCode } from '../src/session/pairingCode';

/** A trip document shaped exactly like `Trip.toJson()` in the Flutter app. */
const TRIP_DATA = {
  id: 'trip-1',
  name: 'רומא באביב',
  startDate: '2026-04-10T00:00:00.000',
  endDate: '2026-04-17T00:00:00.000',
  destinations: [
    { name: 'Rome', lat: 41.9028, lon: 12.4964, address: null, startDate: null, endDate: null },
    { name: 'Florence', lat: null, lon: null, address: null, startDate: null, endDate: null },
  ],
  imageUrl: 'https://example.invalid/rome.jpg',
  imagePath: null,
  travelerCount: 2,
  description: 'שבוע באיטליה',
  isShared: true,
  ownerUsername: 'doron',
  shareMode: 'secure',
};

describe('trip header', () => {
  it('reads the app’s own trip JSON', () => {
    const header = parseHeader(TRIP_DATA, 'fallback');
    expect(header.id).toBe('trip-1');
    expect(header.name).toBe('רומא באביב');
    expect(header.startDate?.getFullYear()).toBe(2026);
    expect(header.destinations).toHaveLength(2);
    expect(header.destinations[0].lat).toBeCloseTo(41.9028);
    expect(header.travelerCount).toBe(2);
  });

  it('survives a document the app has not filled in yet', () => {
    const header = parseHeader({}, 'trip-x');
    expect(header.id).toBe('trip-x');
    expect(header.name).toBe('');
    expect(header.destinations).toEqual([]);
    expect(header.startDate).toBeNull();
    expect(parseHeader(undefined, 'trip-y').id).toBe('trip-y');
    expect(parseHeader('not a map', 'trip-z').id).toBe('trip-z');
  });
});

describe('logistics', () => {
  const items = [
    {
      id: 'h1',
      tripId: 'trip-1',
      mainType: 'hotel',
      hotelName: 'Hotel Roma',
      destination: 'Rome',
      checkIn: '2026-04-10T00:00:00.000',
      checkOut: '2026-04-14T00:00:00.000',
      totalPrice: 820,
      currencyCode: 'EUR',
      paymentStatus: 'fullyPaid',
      starRating: 4,
    },
    {
      id: 'f1',
      tripId: 'trip-1',
      mainType: 'transport',
      subType: 'flight',
      airline: 'ITA',
      flightNumber: 'AZ808',
      departureAirport: 'Ben Gurion (TLV)',
      arrivalAirport: 'Fiumicino (FCO)',
      date: '2026-04-10T05:30:00.000',
      passengers: 2,
    },
    {
      id: 'locked',
      tripId: 'trip-1',
      mainType: 'transport',
      subType: 'train',
      company: 'Trenitalia',
      fromStation: 'Roma Termini',
      toStation: 'Firenze SMN',
      date: '2026-04-14T09:00:00.000',
      totalPrice: 'VEUyAKV8...ciphertext',
      _encrypted: true,
    },
    { mainType: 'hotel', hotelName: 'No id, dropped' },
  ];

  it('describes each kind the way the app does', () => {
    const parsed = parseLogistics(items);
    expect(parsed).toHaveLength(3);

    const [hotel, flight, train] = parsed;
    expect(hotel.title).toBe('Hotel Roma');
    expect(hotel.start?.getDate()).toBe(10);
    expect(hotel.totalPrice).toBe(820);
    expect(hotel.paymentStatus).toBe('fullyPaid');

    expect(flight.title).toBe('ITA AZ808');
    expect(flight.subtitle).toBe('Ben Gurion (TLV) → Fiumicino (FCO)');

    expect(train.subtitle).toBe('Roma Termini → Firenze SMN');
  });

  it('never turns an undecryptable price into a number', () => {
    const [, , train] = parseLogistics(items);
    expect(train.locked).toBe(true);
    expect(train.totalPrice).toBeNull();
  });

  it('ignores entries with no id', () => {
    expect(parseLogistics(items).map((item) => item.id)).toEqual(['h1', 'f1', 'locked']);
    expect(parseLogistics(undefined)).toEqual([]);
    expect(parseLogistics('nonsense')).toEqual([]);
  });
});

describe('schedule', () => {
  const scheduleData = {
    meta: [
      { dateKey: '2026-04-10_Rome', dayTitle: 'יום 1', date: '2026-04-10T00:00:00.000', destination: 'Rome' },
      { dateKey: '2026-04-11_Rome', dayTitle: 'יום 2', date: '2026-04-11T00:00:00.000', destination: 'Rome' },
      { dateKey: '2026-04-12_Rome', dayTitle: 'נמחק', date: '2026-04-12T00:00:00.000', destination: 'Rome' },
    ],
    itemsByDateKey: {
      '2026-04-11_Rome': [{ id: 's2', title: 'Colosseum', startTime: '09:00' }],
      '2026-04-10_Rome': [
        { id: 's1b', title: 'Dinner', startTime: '20:00' },
        { id: 's1a', title: 'Check in', startTime: '15:00' },
      ],
      '2026-04-12_Rome': [{ id: 'gone', title: 'Deleted day' }],
    },
    notesByDateKey: {},
    deletedDates: ['2026-04-12_Rome'],
  };

  it('sorts by day then time and drops deleted days', () => {
    const { days, entries } = parseSchedule(scheduleData);
    expect(days.map((day) => day.dateKey)).toEqual(['2026-04-10_Rome', '2026-04-11_Rome']);
    expect(entries.map((entry) => entry.id)).toEqual(['s1a', 's1b', 's2']);
  });

  it('derives a date from the key when meta is missing', () => {
    const { entries } = parseSchedule({
      meta: [],
      itemsByDateKey: { '2026-05-01_Paris': [{ id: 'x', title: 'Louvre' }] },
    });
    expect(entries[0].date?.getMonth()).toBe(4);
  });

  it('handles an empty or absent schedule', () => {
    expect(parseSchedule(undefined)).toEqual({ days: [], entries: [] });
    expect(parseSchedule({})).toEqual({ days: [], entries: [] });
  });
});

describe('whole snapshot', () => {
  it('counts everything the home screen shows', () => {
    const snapshot = parseTripSnapshot(
      {
        tripData: TRIP_DATA,
        placesData: [{ id: 'p1' }, { id: 'p2' }],
        logisticsData: [{ id: 'h1', mainType: 'hotel', hotelName: 'H' }],
        checklistsData: [{ id: 'c1' }],
        notesData: [{ id: 'n1', _encrypted: true }],
        documentsData: [],
        bookingConfirmationsData: [{ id: 'b1' }],
        scheduleData: { meta: [], itemsByDateKey: {} },
      },
      'trip-1',
      new Date('2026-04-01T00:00:00Z'),
    );

    expect(snapshot.counts.places).toBe(2);
    expect(snapshot.counts.logistics).toBe(1);
    expect(snapshot.counts.bookings).toBe(1);
    expect(snapshot.header.name).toBe('רומא באביב');
    // An encrypted note this session cannot open must be visible as locked.
    expect(snapshot.hasLockedContent).toBe(true);
  });
});

describe('formatting', () => {
  it('counts whole calendar days, not elapsed hours', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(1, 0, 0, 0);
    expect(calendarDaysUntil(tomorrow)).toBe(1);
    expect(calendarDaysUntil(null)).toBeNull();
  });

  it('counts nights between dates', () => {
    expect(nightsBetween(new Date('2026-04-10'), new Date('2026-04-14'))).toBe(4);
    expect(nightsBetween(new Date('2026-04-10'), new Date('2026-04-10'))).toBeNull();
    expect(nightsBetween(null, new Date())).toBeNull();
  });

  it('writes dates in the local, offset-free form the app writes', () => {
    const value = toDateInputValue(new Date(2026, 3, 10));
    expect(value).toBe('2026-04-10');

    // Must match Dart's `DateTime.toIso8601String()` for a *local* DateTime.
    // A `Z` here would hand the app a UTC instant, and every user east of
    // Greenwich would see the trip start a day early.
    expect(fromDateInputValue(value)).toBe('2026-04-10T00:00:00.000');
    expect(fromDateInputValue(value)).not.toMatch(/Z$/);

    // And it survives the round trip back through the parser the app uses.
    expect(asDate(fromDateInputValue(value))?.getDate()).toBe(10);
    expect(asDate(fromDateInputValue(value))?.getMonth()).toBe(3);

    expect(fromDateInputValue('')).toBeNull();
    expect(fromDateInputValue('not-a-date')).toBeNull();
  });
});

describe('pairing code', () => {
  it('is eight characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = createPairingCode();
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
      // No 0/O, 1/I/L or U — nothing a person can mistype into another code.
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{8}$/);
    }
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 500 }, createPairingCode));
    expect(codes.size).toBeGreaterThan(495);
  });

  it('formats as two readable groups', () => {
    expect(formatPairingCode('ABCD2345')).toBe('ABCD-2345');
    expect(formatPairingCode('SHORT')).toBe('SHORT');
  });
});
