import { useEffect, useState } from 'react';

/**
 * Same Open-Meteo call the app makes (`lib/services/weather_service.dart`),
 * so the header shows the same numbers. No key, no account, CORS-friendly —
 * and it is the only non-Firebase host in the CSP.
 */
export interface WeatherDay {
  date: string;
  max: number | null;
  min: number | null;
  code: number | null;
  precipitation: number | null;
}

export interface WeatherSnapshot {
  locationName: string;
  currentTemperature: number | null;
  currentCode: number | null;
  days: WeatherDay[];
}

type State =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: WeatherSnapshot }
  | { status: 'error' };

type TaggedState = State & { forKey: string | null };

export function useWeather(
  lat: number | null | undefined,
  lon: number | null | undefined,
  locationName: string,
): State {
  const forKey = lat == null || lon == null ? null : `${lat},${lon}`;
  const [state, setState] = useState<TaggedState>({ status: 'idle', forKey: null });

  useEffect(() => {
    if (forKey == null) return;
    const controller = new AbortController();

    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lon}` +
      '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum' +
      '&current_weather=true&timezone=auto&forecast_days=7';

    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((json: Record<string, never>) => {
        const daily = (json.daily ?? {}) as Record<string, unknown[]>;
        const times = (daily.time ?? []) as string[];
        const current = (json.current_weather ?? {}) as Record<string, number>;
        setState({
          status: 'ready',
          forKey,
          data: {
            locationName,
            currentTemperature: typeof current.temperature === 'number' ? current.temperature : null,
            currentCode: typeof current.weathercode === 'number' ? current.weathercode : null,
            days: times.map((date, index) => ({
              date,
              max: numberAt(daily.temperature_2m_max, index),
              min: numberAt(daily.temperature_2m_min, index),
              code: numberAt(daily.weathercode, index),
              precipitation: numberAt(daily.precipitation_sum, index),
            })),
          },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', forKey });
      });

    return () => controller.abort();
  }, [forKey, lat, lon, locationName]);

  if (forKey == null) return { status: 'idle' };
  if (state.forKey !== forKey) return { status: 'loading' };
  return state.status === 'ready'
    ? { status: 'ready', data: state.data }
    : { status: state.status };
}

function numberAt(list: unknown[] | undefined, index: number): number | null {
  const value = list?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** WMO weather codes → an emoji, matching the app's icon buckets. */
export function weatherEmoji(code: number | null): string {
  if (code == null) return '🌡️';
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}
