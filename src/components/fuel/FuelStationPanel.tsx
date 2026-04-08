'use client';

import { useState } from 'react';
import { FuelStation, FUEL_TYPE_LABELS } from '@/types';
import { formatPrice } from '@/lib/utils';
import FuelPriceForm from './FuelPriceForm';
import Button from '@/components/ui/Button';

interface FuelStationPanelProps {
  station: FuelStation;
  onClose: () => void;
}

export default function FuelStationPanel({ station, onClose }: FuelStationPanelProps) {
  const [showPriceForm, setShowPriceForm] = useState(false);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-100">{station.name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {station.brand && <p className="text-sm text-gray-400 mb-1">{station.brand}</p>}
      {station.address && <p className="text-sm text-gray-500 mb-3">{station.address}</p>}

      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-300">Ceny paliw</h4>
        {station.prices && station.prices.length > 0 ? (
          station.prices.map((price) => (
            <div key={price.id} className="flex justify-between items-center bg-gray-700/50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-300">{FUEL_TYPE_LABELS[price.fuelType]}</span>
              <span className="text-sm font-semibold text-gray-100">{formatPrice(price.price)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">Brak danych o cenach</p>
        )}
      </div>

      {showPriceForm ? (
        <FuelPriceForm stationId={station.id} onDone={() => setShowPriceForm(false)} />
      ) : (
        <Button onClick={() => setShowPriceForm(true)} variant="secondary" className="w-full">
          Aktualizuj cenę
        </Button>
      )}
    </div>
  );
}
