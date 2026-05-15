'use client';

import { useState, type FormEvent } from 'react';

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

interface CreateRouteFormProps {
  waypoints?: Waypoint[];
  onWaypointAdd?: () => void;
  onCancel?: () => void;
  onCreated?: () => void;
}

export default function CreateRouteForm({
  waypoints = [],
  onWaypointAdd,
  onCancel,
  onCreated,
}: CreateRouteFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (waypoints.length < 2) {
      setError('Dodaj co najmniej 2 punkty trasy.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          waypoints: waypoints.map((wp) => ({
            latitude: wp.lat,
            longitude: wp.lng,
            label: wp.label,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create route.');
        return;
      }

      setName('');
      setDescription('');
      onCreated?.();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="mb-4 text-base font-semibold text-white">
        Create New Route
      </h3>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="route-name"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            Route Name
          </label>
          <input
            id="route-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mountain Pass Drive"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label
            htmlFor="route-description"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            Description
          </label>
          <textarea
            id="route-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Waypoints */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-300">
              Waypoints ({waypoints.length})
            </label>
            <button
              type="button"
              onClick={onWaypointAdd}
              className="text-xs font-medium text-blue-500 transition hover:text-blue-400"
            >
              + Click map to add
            </button>
          </div>

          {waypoints.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center">
              <svg
                className="mx-auto mb-2 h-8 w-8 text-zinc-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <p className="text-xs text-zinc-500">
                Click on the map to add waypoints
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {waypoints.map((wp, index) => (
                <li
                  key={wp.id}
                  className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-xs text-zinc-300">
                    {wp.label ?? `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Create Route'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
