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

function SpotMarker({ spot }: SpotMarkerProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const userLocation = useMapStore((s) => s.userLocation);
  const removeSpot = useSpotStore((s) => s.removeSpot);

  const color = VISIBILITY_COLOR[spot.visibility] ?? '#6b7280';

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
    if (isClosing) return;
    setIsClosing(true);
    try {
      const res = await fetch(`/api/spots/${spot.id}/close`, { method: 'PATCH' });
      if (res.ok) {
        removeSpot(spot.id);
        setShowPopup(false);
      }
    } catch (err) {
      console.error('Close spot failed:', err);
    } finally {
      setIsClosing(false);
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
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
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
                Spot · {VISIBILITY_LABEL[spot.visibility]}
              </Badge>
              <span className="text-xs text-gray-400">{timeAgo(spot.createdAt)}</span>
            </div>

            {spot.title && (
              <p className="mb-1 text-sm font-semibold text-gray-100">{spot.title}</p>
            )}

            {spot.description && (
              <p className="mb-2 text-sm text-gray-300">{spot.description}</p>
            )}

            <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
              <span>Założył:</span>
              <span className="text-gray-300">{spot.createdBy?.name ?? 'Ktoś'}</span>
            </div>

            {distanceLabel && (
              <div className="mb-2 text-xs text-gray-400">
                {distanceLabel} od Ciebie
              </div>
            )}

            {spot.isOwner && (
              <button
                onClick={handleClose}
                disabled={isClosing}
                className="mt-1 w-full rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-red-900/60 hover:text-red-300 disabled:opacity-50"
              >
                {isClosing ? 'Zamykanie…' : 'Zamknij spot'}
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
  prev.spot.closedAt === next.spot.closedAt
);
