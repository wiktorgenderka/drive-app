'use client';

import { useState } from 'react';
import { FuelType, FUEL_TYPE_LABELS } from '@/types';
import Button from '@/components/ui/Button';

interface FuelPriceFormProps {
  stationId: string;
  onDone: () => void;
}

export default function FuelPriceForm({ stationId, onDone }: FuelPriceFormProps) {
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.PETROL_95);
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!price || isNaN(Number(price))) return;
    setIsSubmitting(true);
    try {
      await fetch(`/api/fuel/${stationId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuelType, price: parseFloat(price) }),
      });
      onDone();
    } catch (err) {
      console.error('Failed to update price:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <select
        value={fuelType}
        onChange={(e) => setFuelType(e.target.value as FuelType)}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
      >
        {Object.values(FuelType).map((type) => (
          <option key={type} value={type}>
            {FUEL_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <div className="relative">
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Cena za litr"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-accent focus:outline-none pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">PLN</span>
      </div>

      <div className="flex gap-2">
        <Button onClick={onDone} variant="ghost" size="sm" className="flex-1">
          Anuluj
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting} size="sm" className="flex-1">
          Zapisz
        </Button>
      </div>
    </div>
  );
}
