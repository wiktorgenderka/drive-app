'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtDist, fmtTripTime } from '@/lib/mapNavigation';

interface FinishedTrip {
  distance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
}

interface TripSummaryModalProps {
  show: boolean;
  trip: FinishedTrip | null;
  onClose: () => void;
  userName?: string;
}

type ActiveView = 'summary' | 'share';

export default function TripSummaryModal({ show, trip, onClose, userName = 'Kierowca' }: TripSummaryModalProps) {
  const [activeView, setActiveView] = useState<ActiveView>('summary');
  const [copying, setCopying] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const stats = trip
    ? [
        { label: 'Czas',          value: fmtTripTime(trip.duration),             emoji: '⏱️' },
        { label: 'Dystans',       value: fmtDist(trip.distance),                  emoji: '🛣️' },
        { label: 'Max prędkość',  value: `${Math.round(trip.maxSpeed)} km/h`,     emoji: '🚀' },
        { label: 'Śr. prędkość',  value: `${Math.round(trip.avgSpeed)} km/h`,     emoji: '📊' },
      ]
    : [];

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setCopying(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        useCORS: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare({ files: [new File([blob], 'driveapp-trip.png', { type: 'image/png' })] })) {
          await navigator.share({
            title: 'Moja podróż — DriveApp',
            files: [new File([blob], 'driveapp-trip.png', { type: 'image/png' })],
          });
        } else {
          // Fallback — download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'driveapp-trip.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (e) {
      console.error('Share failed', e);
    } finally {
      setCopying(false);
    }
  }, []);

  return (
    <AnimatePresence>
      {show && trip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="w-full max-w-sm"
          >
            {activeView === 'summary' ? (
              <div className="rounded-3xl border border-card-border bg-card-bg p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-xl">🏁</div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-foreground">Podróż zakończona</h2>
                    <p className="text-xs text-muted">
                      {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 400, damping: 22 }}
                    className="flex items-center gap-1 rounded-xl bg-accent/15 px-2.5 py-1.5 shrink-0"
                  >
                    <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="text-sm font-black text-accent">+50 XP</span>
                  </motion.div>
                </div>

                {/* Stats grid */}
                <div className="mb-5 grid grid-cols-2 gap-3">
                  {stats.map(({ label, value, emoji }) => (
                    <div key={label} className="rounded-xl bg-input-bg px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base">{emoji}</span>
                        <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                      </div>
                      <p className="text-lg font-extrabold text-foreground tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveView('share')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-card-border bg-card-bg py-2.5 text-sm font-semibold text-foreground transition hover:bg-input-bg"
                  >
                    <span>📤</span> Udostępnij
                  </button>
                  <button
                    onClick={onClose}
                    className="flex flex-1 items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            ) : (
              /* SHARE CARD VIEW */
              <div className="rounded-3xl border border-card-border bg-card-bg p-5 shadow-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('summary')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <p className="text-sm font-semibold text-foreground">Karta do udostępnienia</p>
                </div>

                {/* Shareable card preview */}
                <div
                  ref={cardRef}
                  className="mx-auto w-full rounded-2xl overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)', padding: 24 }}
                >
                  {/* App logo line */}
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center text-base" style={{ background: '#f97316' }}>🛣️</div>
                    <span className="text-sm font-bold" style={{ color: '#f97316' }}>DriveApp</span>
                    <span className="ml-auto text-xs" style={{ color: '#71717a' }}>
                      {new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Big stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {stats.map(({ label, value, emoji }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 16px' }}>
                        <p style={{ fontSize: 11, color: '#71717a', marginBottom: 2 }}>{emoji} {label}</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>@{userName}</span>
                    <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>app.driveapp.pl</span>
                  </div>
                </div>

                <button
                  onClick={handleShare}
                  disabled={copying}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {copying ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Generowanie…
                    </>
                  ) : (
                    <>📤 Udostępnij podróż</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
