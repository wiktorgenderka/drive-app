'use client';

import { useState, useEffect } from 'react';

export interface WeatherData {
  temp: number;
  code: number;
  windKmh: number;
  label: string;
  isDay: boolean;
}

function codeToLabel(code: number): string {
  if (code === 0) return 'Bezchmurnie';
  if (code <= 3) return 'Zachmurzenie';
  if (code <= 48) return 'Mgła';
  if (code <= 55) return 'Mżawka';
  if (code <= 67) return 'Deszcz';
  if (code <= 77) return 'Śnieg';
  if (code <= 82) return 'Przelotny deszcz';
  if (code <= 99) return 'Burza';
  return '';
}

export function useWeather(lat?: number | null, lng?: number | null): WeatherData | null {
  const [data, setData] = useState<WeatherData | null>(null);

  // round to ~1km precision to avoid re-fetching on every GPS jitter
  const latKey = lat != null ? Math.round(lat * 10) : null;
  const lngKey = lng != null ? Math.round(lng * 10) : null;

  useEffect(() => {
    if (latKey == null || lngKey == null) return;
    const la = latKey / 10;
    const lo = lngKey / 10;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${la}&longitude=${lo}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,is_day` +
      `&wind_speed_unit=kmh&timezone=auto`;

    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const c = d.current;
        setData({
          temp: Math.round(c.temperature_2m),
          code: c.weather_code,
          windKmh: Math.round(c.wind_speed_10m),
          label: codeToLabel(c.weather_code),
          isDay: c.is_day === 1,
        });
      })
      .catch(() => {});
  }, [latKey, lngKey]);

  return data;
}
