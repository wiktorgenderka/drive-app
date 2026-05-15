'use client';

import { useState, useEffect, useRef } from 'react';
import { useWeather } from '@/hooks/useWeather';

interface Props {
  lat?: number | null;
  lng?: number | null;
}

interface Alert {
  level: 'warning' | 'danger';
  icon: string;
  title: string;
  advice: string;
}

function getAlert(code: number, windKmh: number): Alert | null {
  if (code >= 95) {
    return { level: 'danger', icon: '⛈️', title: 'Burza z wyładowaniami', advice: 'Unikaj otwartych terenów, zjadź na parking.' };
  }
  if (code >= 85) {
    return { level: 'danger', icon: '🌨️', title: 'Intensywne opady śniegu', advice: 'Zmniejsz prędkość, zachowaj odstęp.' };
  }
  if (code >= 82) {
    return { level: 'danger', icon: '🌧️', title: 'Ulewny deszcz', advice: 'Uwaga na aquaplaning, zmniejsz prędkość.' };
  }
  if (code >= 71) {
    return { level: 'warning', icon: '🌨️', title: 'Opady śniegu', advice: 'Sprawdź opony, jedź ostrożnie.' };
  }
  if (code >= 65) {
    return { level: 'warning', icon: '🌧️', title: 'Intensywny deszcz', advice: 'Zmniejsz prędkość, włącz światła.' };
  }
  if (code >= 45 && code <= 48) {
    return { level: 'warning', icon: '🌫️', title: 'Gęsta mgła', advice: 'Jedź wolniej, włącz światła przeciwmgielne.' };
  }
  if (windKmh >= 70) {
    return { level: 'danger', icon: '💨', title: `Silny wiatr ${windKmh} km/h`, advice: 'Uwaga na pojazdy wysokie i przyczepy.' };
  }
  if (windKmh >= 50) {
    return { level: 'warning', icon: '💨', title: `Wiatr ${windKmh} km/h`, advice: 'Zachowaj ostrożność, szczególnie na wiaduktach.' };
  }
  return null;
}

export default function WeatherRouteAlert({ lat, lng }: Props) {
  const weather = useWeather(lat, lng);
  const [dismissed, setDismissed] = useState(false);
  const prevCodeRef = useRef<number | null>(null);

  const alert = weather ? getAlert(weather.code, weather.windKmh) : null;

  useEffect(() => {
    if (!weather) return;
    if (prevCodeRef.current !== weather.code) {
      setDismissed(false);
      prevCodeRef.current = weather.code;
    }
  }, [weather]);

  if (!alert || dismissed) return null;

  const isDanger = alert.level === 'danger';

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
      isDanger
        ? 'bg-red-900/40 border-red-600/50 text-red-200'
        : 'bg-yellow-900/40 border-yellow-600/50 text-yellow-200'
    }`}>
      <span className="text-lg shrink-0 leading-none mt-0.5">{alert.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-xs leading-tight">{alert.title}</p>
        <p className="text-xs opacity-80 mt-0.5">{alert.advice}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label="Zamknij"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
