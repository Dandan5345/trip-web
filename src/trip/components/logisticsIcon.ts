import type { LogisticsItem } from '../model';

/** Emoji per logistics kind, matching `transportSubTypeIcon` in the app. */
const ICONS: Record<string, string> = {
  hotel: '🏨',
  flight: '✈️',
  carRental: '🚗',
  ride: '🚕',
  train: '🚆',
  ferry: '⛴️',
  cruise: '🛳️',
};

export function logisticsIcon(item: LogisticsItem): string {
  return ICONS[item.mainType === 'hotel' ? 'hotel' : (item.subType ?? '')] ?? '📍';
}
