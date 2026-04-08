'use client';

import { useState } from 'react';
import { ReportType, REPORT_TYPE_LABELS } from '@/types';
import { useMapStore } from '@/stores/useMapStore';
import Button from '@/components/ui/Button';

const reportTypeIcons: Record<ReportType, string> = {
  [ReportType.POLICE]: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  [ReportType.UNMARKED_POLICE]: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  [ReportType.SPEED_TRAP]: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  [ReportType.ACCIDENT]: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  [ReportType.OBSTACLE]: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
  [ReportType.SPEED_CAMERA]: 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a.75.75 0 00.75.75h.008a.75.75 0 00.75-.75 2.25 2.25 0 014.5 0 .75.75 0 00.75.75h5.985a.75.75 0 00.75-.75 2.25 2.25 0 014.5 0 .75.75 0 00.75.75h.008a.75.75 0 00.75-.75V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z',
};

export default function ReportPanel({ onClose }: { onClose: () => void }) {
  const [selectedType, setSelectedType] = useState<ReportType>(ReportType.POLICE);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userLocation = useMapStore((s) => s.userLocation);

  const handleSubmit = async () => {
    if (!userLocation) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          description: description || undefined,
        }),
      });
      if (res.ok) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to create report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">Nowe zgłoszenie</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {Object.values(ReportType).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-colors ${
              selectedType === type
                ? 'bg-accent/20 text-accent border border-accent/50'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={reportTypeIcons[type]} />
            </svg>
            {REPORT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Opis (opcjonalnie)..."
        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-500 focus:border-accent focus:outline-none resize-none mb-4"
        rows={3}
      />

      {userLocation ? (
        <p className="text-xs text-gray-500 mb-3">
          Lokalizacja: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
        </p>
      ) : (
        <p className="text-xs text-yellow-400 mb-3">Włącz lokalizację, aby dodać zgłoszenie</p>
      )}

      <Button
        onClick={handleSubmit}
        isLoading={isSubmitting}
        disabled={!userLocation}
        className="w-full"
      >
        Dodaj zgłoszenie
      </Button>
    </div>
  );
}
