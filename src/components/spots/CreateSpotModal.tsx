'use client';

import { useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useSpotStore } from '@/stores/useSpotStore';
import type { Spot } from '@/types';
import Button from '@/components/ui/Button';

type Visibility = 'FRIENDS' | 'PUBLIC';

interface CreateSpotModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateSpotModal({ open, onClose }: CreateSpotModalProps) {
  const userLocation = useMapStore((s) => s.userLocation);
  const addSpot = useSpotStore((s) => s.addSpot);
  const [visibility, setVisibility] = useState<Visibility>('FRIENDS');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setDescription('');
    setVisibility('FRIENDS');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!userLocation) {
      setError('Brak lokalizacji — włącz GPS, aby utworzyć spot.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const detail =
          typeof data?.error === 'string'
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : `HTTP ${res.status}`;
        console.error('[create-spot] failed', res.status, data);
        setError(`Nie udało się utworzyć spota: ${detail}`);
        return;
      }
      const spot: Spot = await res.json();
      addSpot(spot);
      reset();
      onClose();
    } catch (err) {
      console.error('[create-spot] network error', err);
      setError('Błąd sieci');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Nowy spot</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:text-foreground"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="mb-3 block text-xs font-medium text-muted">
          Widoczność
        </label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['FRIENDS', 'PUBLIC'] as Visibility[]).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                visibility === v
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-input-border bg-input-bg text-muted hover:text-foreground'
              }`}
            >
              {v === 'FRIENDS' ? 'Tylko znajomi' : 'Publiczny'}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Tytuł (opcjonalnie)"
          className="mb-3 w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 280))}
          placeholder="Opis (opcjonalnie)"
          rows={3}
          className="mb-3 w-full resize-none rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />

        {userLocation ? (
          <p className="mb-3 text-xs text-muted">
            Lokalizacja: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
          </p>
        ) : (
          <p className="mb-3 text-xs text-yellow-400">
            Włącz GPS, aby utworzyć spot.
          </p>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-400">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          isLoading={isSubmitting}
          disabled={!userLocation}
          className="w-full"
        >
          Utwórz spot
        </Button>
      </div>
    </div>
  );
}
