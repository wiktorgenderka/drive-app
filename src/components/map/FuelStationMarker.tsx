'use client';

import { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';
import type { FuelStation } from '@/stores/useMapStore';
import { formatPrice } from '@/lib/utils';

const FUEL_TYPE_LABELS: Record<string, string> = {
  PETROL_95: 'Benzyna 95',
  PETROL_98: 'Benzyna 98',
  DIESEL: 'Diesel',
  LPG: 'LPG',
};

interface FuelStationMarkerProps {
  station: FuelStation;
}

export default function FuelStationMarker({ station }: FuelStationMarkerProps) {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <>
      <Marker
        latitude={station.latitude}
        longitude={station.longitude}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          setShowPopup(true);
        }}
      >
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center cursor-pointer shadow-lg border-2 border-white">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
        </div>
      </Marker>

      {showPopup && (
        <Popup
          latitude={station.latitude}
          longitude={station.longitude}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
        >
          <div className="p-2 min-w-48">
            <h3 className="font-semibold text-sm text-gray-900">{station.name}</h3>
            {station.brand && <p className="text-xs text-gray-500 mb-1">{station.brand}</p>}
            {station.address && <p className="text-xs text-gray-500 mb-2">{station.address}</p>}
            {station.prices && station.prices.length > 0 ? (
              <div className="space-y-1">
                {station.prices.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-gray-600">{FUEL_TYPE_LABELS[p.fuelType]}</span>
                    <span className="font-medium text-gray-900">{formatPrice(p.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Brak danych o cenach</p>
            )}
          </div>
        </Popup>
      )}
    </>
  );
}
