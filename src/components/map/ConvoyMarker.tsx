'use client';

import { memo } from 'react';
import { Marker } from 'react-map-gl/mapbox';

interface ConvoyMarkerProps {
  latitude: number;
  longitude: number;
  name: string;
}

function ConvoyMarker({ latitude, longitude, name }: ConvoyMarkerProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Marker latitude={latitude} longitude={longitude} anchor="bottom">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-lg">
          {initials}
        </div>
        <div className="mt-1 px-2 py-0.5 bg-gray-900/80 rounded text-xs text-white whitespace-nowrap">
          {name}
        </div>
      </div>
    </Marker>
  );
}

export default memo(ConvoyMarker, (prev, next) =>
  prev.latitude === next.latitude &&
  prev.longitude === next.longitude &&
  prev.name === next.name
);
