'use client';

import { useMapStore } from '@/stores/useMapStore';
const REPORT_LABELS: Record<string, string> = {
  police: 'Policja',
  speed_trap: 'Kontrola prędkości',
  accident: 'Wypadek',
  hazard: 'Zagrożenie',
  traffic: 'Korek',
  closure: 'Zamknięta droga',
  obstacle: 'Przeszkoda',
  other: 'Inne',
  POLICE: 'Policja',
  SPEED_TRAP: 'Kontrola prędkości',
  ACCIDENT: 'Wypadek',
  OBSTACLE: 'Przeszkoda',
  SPEED_CAMERA: 'Fotoradar',
};
import { timeAgo } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

export default function ReportList() {
  const reports = useMapStore((s) => s.reports);

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm">Brak zgłoszeń w okolicy</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <div
          key={report.id}
          className="bg-gray-700/50 rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between mb-1">
            <Badge variant={report.type === 'ACCIDENT' ? 'danger' : 'warning'}>
              {REPORT_LABELS[report.type] || report.type}
            </Badge>
            <span className="text-xs text-gray-500">{timeAgo(report.createdAt)}</span>
          </div>
          {report.description && (
            <p className="text-sm text-gray-300 mt-1">{report.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="text-green-400">+{report.upvotes ?? 0}</span>
            <span className="text-red-400">-{report.downvotes ?? 0}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
