'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
}

interface SharedRoute {
  id: string;
  name: string;
  description: string | null;
  waypoints: unknown;
  avgRating: number | null;
  ratingCount: number;
  createdAt: string;
  user: { id: string; name: string; image: string | null };
}

function parseWaypoints(raw: unknown): Waypoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((w): w is Waypoint => w && typeof w === 'object' && 'lat' in w && 'lng' in w);
}

export default function SharedRouteView({ route }: { route: SharedRoute }) {
  const [copied, setCopied] = useState(false);
  const waypoints = parseWaypoints(route.waypoints);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center p-4 pt-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1 text-xs text-yellow-400 mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Udostępniona trasa
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-1">{route.name}</h1>
          {route.description && <p className="text-sm text-gray-400">{route.description}</p>}
        </div>

        {/* Author */}
        <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center text-sm font-bold text-yellow-400">
            {route.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">{route.user.name}</p>
            <p className="text-xs text-gray-500">
              {new Date(route.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {route.avgRating && (
            <div className="ml-auto flex items-center gap-1 text-yellow-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm font-semibold">{route.avgRating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({route.ratingCount})</span>
            </div>
          )}
        </div>

        {/* Waypoints */}
        {waypoints.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Punkty trasy ({waypoints.length})
            </h3>
            <ol className="space-y-2">
              {waypoints.map((wp, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-green-500 text-black' :
                    i === waypoints.length - 1 ? 'bg-red-500 text-white' :
                    'bg-gray-600 text-gray-200'
                  }`}>
                    {i === 0 ? 'S' : i === waypoints.length - 1 ? 'M' : i}
                  </span>
                  <span className="text-gray-300">
                    {wp.name ?? `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {copied ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              )}
            </svg>
            {copied ? 'Skopiowano!' : 'Kopiuj link'}
          </button>
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 rounded-xl px-4 py-3 text-sm font-semibold text-black transition-colors"
          >
            Otwórz w aplikacji
          </Link>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Udostępnione za pomocą{' '}
          <Link href="/dashboard" className="text-yellow-500 hover:underline">DriveApp</Link>
        </p>
      </div>
    </div>
  );
}
