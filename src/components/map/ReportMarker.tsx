'use client';

import { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';
import type { Report } from '@/stores/useMapStore';
import { useMapStore } from '@/stores/useMapStore';
import { timeAgo, calculateDistance, formatDistance } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

interface ReportMarkerProps {
  report: Report;
}

const reportColors: Record<string, string> = {
  POLICE: '#3b82f6',
  UNMARKED_POLICE: '#6366f1',
  SPEED_TRAP: '#f59e0b',
  ACCIDENT: '#ef4444',
  OBSTACLE: '#f97316',
  SPEED_CAMERA: '#a855f7',
  police: '#3b82f6',
  speed_trap: '#f59e0b',
  accident: '#ef4444',
  hazard: '#f97316',
  traffic: '#a855f7',
  closure: '#ef4444',
  other: '#6b7280',
};

const reportLabels: Record<string, string> = {
  POLICE: 'Policja',
  UNMARKED_POLICE: 'Tajniaki',
  SPEED_TRAP: 'Kontrola prędkości',
  ACCIDENT: 'Wypadek',
  OBSTACLE: 'Przeszkoda',
  SPEED_CAMERA: 'Fotoradar',
  police: 'Policja',
  speed_trap: 'Kontrola prędkości',
  accident: 'Wypadek',
  hazard: 'Zagrożenie',
  traffic: 'Korek',
  closure: 'Zamknięta droga',
  other: 'Inne',
};

const reportIcons: Record<string, string> = {
  POLICE: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  UNMARKED_POLICE: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  SPEED_TRAP: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  ACCIDENT: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  OBSTACLE: 'M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
  SPEED_CAMERA: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z',
  police: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  speed_trap: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  accident: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  hazard: 'M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
  traffic: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375',
  closure: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  other: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
};

// Show distance badge when closer than this (in meters)
const DISTANCE_SHOW_THRESHOLD = 5000;

export default function ReportMarker({ report }: ReportMarkerProps) {
  const [showPopup, setShowPopup] = useState(false);
  const userLocation = useMapStore((s) => s.userLocation);
  const updateReportVotes = useMapStore((s) => s.updateReportVotes);
  const removeReport = useMapStore((s) => s.removeReport);
  const color = reportColors[report.type] || '#6b7280';
  const upvotes = report.upvotes ?? 0;
  const downvotes = report.downvotes ?? 0;

  // Calculate distance from user
  let distanceMeters: number | null = null;
  let distanceLabel = '';
  if (userLocation) {
    distanceMeters = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      report.latitude,
      report.longitude
    );
    distanceLabel = formatDistance(distanceMeters);
  }

  const isNearby = distanceMeters !== null && distanceMeters <= DISTANCE_SHOW_THRESHOLD;

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: 'DELETE' });
      if (res.ok) {
        removeReport(report.id);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleVote = async (isUpvote: boolean) => {
    try {
      const res = await fetch(`/api/reports/${report.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isUpvote }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deleted) {
          removeReport(report.id);
        } else {
          updateReportVotes(report.id, data.upvotes, data.downvotes, data.userVote);
        }
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  return (
    <>
      <Marker
        latitude={report.latitude}
        longitude={report.longitude}
        anchor="center"
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          setShowPopup(true);
        }}
      >
        <div className="flex flex-col items-center">
          {/* Distance badge - shown when within 5km */}
          {isNearby && (
            <div
              className="mb-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {distanceLabel}
            </div>
          )}
          {/* Marker circle */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-white transition-transform ${
              isNearby ? 'scale-110' : ''
            }`}
            style={{ backgroundColor: color }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={reportIcons[report.type]} />
            </svg>
          </div>
        </div>
      </Marker>

      {showPopup && (
        <Popup
          latitude={report.latitude}
          longitude={report.longitude}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
          className="report-popup"
        >
          <div className="p-3 min-w-52">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={report.type === 'ACCIDENT' || report.type === 'accident' ? 'danger' : 'warning'}>
                {reportLabels[report.type] || report.type}
              </Badge>
              <span className="text-xs text-gray-400">{timeAgo(report.createdAt)}</span>
            </div>

            {/* Distance in popup */}
            {distanceMeters !== null && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-300">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 11l19-9-9 19-2-8-8-2z" />
                </svg>
                <span>{distanceLabel} od Ciebie</span>
              </div>
            )}

            {report.description && (
              <p className="text-sm text-gray-300 mb-2">{report.description}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVote(true)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                  report.userVote === true
                    ? 'bg-green-600 text-white ring-1 ring-green-400'
                    : 'bg-green-900/50 text-green-400 hover:bg-green-900/80'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
                {upvotes}
              </button>
              <button
                onClick={() => handleVote(false)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                  report.userVote === false
                    ? 'bg-red-600 text-white ring-1 ring-red-400'
                    : 'bg-red-900/50 text-red-400 hover:bg-red-900/80'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                {downvotes}
              </button>
              {report.isOwner && (
                <button
                  onClick={handleDelete}
                  className="ml-auto flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-red-900/60 hover:text-red-400 transition"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Anuluj
                </button>
              )}
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}
