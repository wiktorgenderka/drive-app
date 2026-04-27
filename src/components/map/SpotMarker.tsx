'use client';

import { useState, memo } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';
import type { Spot } from '@/types';
import { useSpotStore } from '@/stores/useSpotStore';
import { useMapStore } from '@/stores/useMapStore';
import { timeAgo, calculateDistance, formatDistance } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

interface SpotMarkerProps {
  spot: Spot;
}

const VISIBILITY_COLOR: Record<string, string> = {
  PUBLIC: '#10b981',
  FRIENDS: '#a855f7',
};

const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: 'Publiczny',
  FRIENDS: 'Znajomi',
};

const KIND_LABEL: Record<string, string> = {
  AUTO: 'Auto',
  MANUAL: 'Ręczny',
};

function SpotMarker({ spot }: SpotMarkerProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [busy, setBusy] = useState(false);
  const userLocation = useMapStore((s) => s.userLocation);
  const removeSpot = useSpotStore((s) => s.removeSpot);

  const color = VISIBILITY_COLOR[spot.visibility] ?? '#6b7280';
  const isAuto = spot.kind === 'AUTO';
  const participants = spot.participants ?? [];

  let distanceLabel = '';
  if (userLocation) {
    const d = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      spot.latitude,
      spot.longitude
    );
    distanceLabel = formatDistance(d);
  }

  const handleClose = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spots/${spot.id}/close`, { method: 'PATCH' });
      if (res.ok) {
        removeSpot(spot.id);
        setShowPopup(false);
      }
    } catch (err) {
      console.error('Close spot failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spots/${spot.id}/leave`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.closed) {
          removeSpot(spot.id);
        }
        setShowPopup(false);
      }
    } catch (err) {
      console.error('Leave spot failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Marker
        latitude={spot.latitude}
        longitude={spot.longitude}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          setShowPopup(true);
        }}
      >
        <div
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
        >
          {isAuto ? (
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 7a4 4 0 11-8 0 4 4 0 018 0zM20 8a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          )}
          {isAuto && participants.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-gray-800 shadow">
              {participants.length}
            </span>
          )}
        </div>
      </Marker>

      {showPopup && (
        <Popup
          latitude={spot.latitude}
          longitude={spot.longitude}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
        >
          <div className="min-w-56 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={spot.visibility === 'PUBLIC' ? 'success' : 'info'}>
                Spot · {KIND_LABEL[spot.kind]} · {VISIBILITY_LABEL[spot.visibility]}
              </Badge>
              <span className="text-xs text-gray-400">{timeAgo(spot.createdAt)}</span>
            </div>

            {spot.title && (
              <p className="mb-1 text-sm font-semibold text-gray-100">{spot.title}</p>
            )}

            {spot.description && (
              <p className="mb-2 text-sm text-gray-300">{spot.description}</p>
            )}

            {isAuto && participants.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-xs text-gray-400">
                  Uczestnicy ({participants.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {participants.map((p) => (
                    <span
                      key={p.id}
                      className="rounded-full bg-gray-700/80 px-2 py-0.5 text-xs text-gray-200"
                    >
                      {p.user?.name ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!isAuto && (
              <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
                <span>Założył:</span>
                <span className="text-gray-300">{spot.createdBy?.name ?? 'Ktoś'}</span>
              </div>
            )}

            {distanceLabel && (
              <div className="mb-2 text-xs text-gray-400">
                {distanceLabel} od Ciebie
              </div>
            )}

            {!isAuto && spot.isOwner && (
              <button
                onClick={handleClose}
                disabled={busy}
                className="mt-1 w-full rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50"
              >
                {busy ? 'Zamykanie…' : 'Zamknij spot'}
              </button>
            )}

            {isAuto && spot.isParticipant && (
              <button
                onClick={handleLeave}
                disabled={busy}
                className="mt-1 w-full rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50"
              >
                {busy ? 'Opuszczanie…' : 'Wyjdź ze spota'}
              </button>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}

export default memo(SpotMarker, (prev, next) =>
  prev.spot.id === next.spot.id &&
  prev.spot.closedAt === next.spot.closedAt &&
  (prev.spot.participants?.length ?? 0) === (next.spot.participants?.length ?? 0) &&
  prev.spot.isParticipant === next.spot.isParticipant
);
