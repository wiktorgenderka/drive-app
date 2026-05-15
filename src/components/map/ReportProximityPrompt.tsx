'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { calculateDistance, formatDistance, timeAgo } from '@/lib/utils';

const PROMPT_RADIUS = 800; // Show prompt within 800 m
const FRESH_MINUTES = 30; // Only for reports created within last 30 min
const COOLDOWN_MS = 60_000; // Don't re-show same report for 60 s after dismiss
const CONFIRM_THRESHOLD = 5; // After 5 upvotes, stop asking (for 30 min)
const CONFIRM_WINDOW_MS = 30 * 60 * 1000; // 30 min after confirmation, ask again

const REPORT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  POLICE:          { label: 'Policja',            color: 'text-blue-400',   bg: 'bg-blue-500/20',   border: 'border-accent/40',   icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  UNMARKED_POLICE: { label: 'Tajniaki',           color: 'text-indigo-400', bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  SPEED_TRAP:      { label: 'Kontrola prÄ™dkoĹ›ci', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
  ACCIDENT:        { label: 'Wypadek',            color: 'text-red-400',    bg: 'bg-red-500/20',    border: 'border-red-500/40',    icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  OBSTACLE:        { label: 'Przeszkoda',         color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/40', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  SPEED_CAMERA:    { label: 'Fotoradar',          color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40', icon: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' },
};

export default function ReportProximityPrompt() {
  const userLocation = useMapStore((s) => s.userLocation);
  const reports = useMapStore((s) => s.reports);
  const updateReportVotes = useMapStore((s) => s.updateReportVotes);
  const removeReport = useMapStore((s) => s.removeReport);

  // Track which reports the user already acted on or dismissed in this session
  const handledRef = useRef<Map<string, number>>(new Map());
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  // Bump this to force candidate re-evaluation after dismiss/vote
  const [dismissCount, setDismissCount] = useState(0);

  // Find the closest fresh report the user hasn't handled yet
  const candidate = useMemo(() => {
    if (!userLocation || reports.length === 0) return null;

    const now = Date.now();
    const freshCutoff = now - FRESH_MINUTES * 60 * 1000;

    return reports
      .filter((r) => {
        // Must be fresh
        const created = typeof r.createdAt === 'string' ? new Date(r.createdAt).getTime() : r.createdAt;
        if (created < freshCutoff) return false;
        // Must not be recently handled in this session
        const handledAt = handledRef.current.get(r.id);
        if (handledAt && now - handledAt < COOLDOWN_MS) return false;
        // Skip if user already voted on this report (unless it's their own)
        if (r.userVote !== null && r.userVote !== undefined && !r.isOwner) return false;
        // Skip if report has 5+ confirmations and was confirmed within last 30 min
        if (r.upvotes >= CONFIRM_THRESHOLD) {
          const confirmed = r.confirmedAt
            ? (typeof r.confirmedAt === 'string' ? new Date(r.confirmedAt).getTime() : r.confirmedAt)
            : 0;
          if (now - confirmed < CONFIRM_WINDOW_MS) return false;
        }
        return true;
      })
      .map((r) => ({
        ...r,
        distance: calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          r.latitude,
          r.longitude
        ),
      }))
      .filter((r) => r.distance <= PROMPT_RADIUS)
      .sort((a, b) => a.distance - b.distance)[0] ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, reports, dismissCount]);

  // Auto-show when a candidate enters range
  useEffect(() => {
    if (candidate && candidate.id !== activeReportId) {
      setActiveReportId(candidate.id);
    } else if (!candidate && activeReportId) {
      const t = setTimeout(() => setActiveReportId(null), 3000);
      return () => clearTimeout(t);
    }
  }, [candidate, activeReportId]);

  const markHandled = useCallback((reportId: string) => {
    handledRef.current.set(reportId, Date.now());
    setActiveReportId(null);
    setDismissCount((c) => c + 1);
  }, []);

  const handleVote = useCallback(async (isUpvote: boolean) => {
    if (!activeReportId || isVoting) return;
    setIsVoting(true);
    try {
      const res = await fetch(`/api/reports/${activeReportId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isUpvote }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deleted) {
          removeReport(activeReportId);
        } else {
          updateReportVotes(activeReportId, data.upvotes, data.downvotes, data.userVote);
        }
      }
    } catch {
      // silent
    } finally {
      const id = activeReportId;
      setIsVoting(false);
      markHandled(id);
    }
  }, [activeReportId, isVoting, updateReportVotes, removeReport, markHandled]);

  const handleDismiss = useCallback(() => {
    if (activeReportId) {
      markHandled(activeReportId);
    }
  }, [activeReportId, markHandled]);

  // Find the active report data
  const activeReport = useMemo(() => {
    if (!activeReportId) return null;
    return reports.find((r) => r.id === activeReportId) ?? null;
  }, [activeReportId, reports]);

  const distance = useMemo(() => {
    if (!activeReport || !userLocation) return '';
    return formatDistance(
      calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        activeReport.latitude,
        activeReport.longitude
      )
    );
  }, [activeReport, userLocation]);

  if (!activeReport) return null;

  const meta = REPORT_META[activeReport.type] ?? REPORT_META.OBSTACLE;
  const isOwner = activeReport.isOwner === true;
  const ago = timeAgo(activeReport.createdAt);

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md animate-slide-up">
      <div className={`rounded-3xl border ${meta.border} bg-card-bg/95 backdrop-blur-xl shadow-2xl overflow-hidden`}>
        {/* Report info */}
        <div className="flex items-center gap-4 px-5 pt-5 pb-3">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.color}`}>
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-lg font-bold ${meta.color}`}>
              {meta.label}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted">{distance} od Ciebie</span>
              <span className="text-xs text-muted/60">Â·</span>
              <span className="text-xs text-muted/60">{ago}</span>
            </div>
            {isOwner && (
              <p className="text-xs text-muted/50 mt-0.5">TwĂłj raport</p>
            )}
          </div>
          {/* Close / dismiss button */}
          <button
            onClick={handleDismiss}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted hover:text-foreground transition active:scale-95"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Question */}
        <p className="px-5 pb-4 text-sm text-muted">
          {isOwner
            ? 'Czy TwĂłj raport jest nadal aktualny?'
            : 'Czy ten raport jest aktualny?'}
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 px-5 pb-5">
          {isOwner ? (
            /* Owner: single large confirm button */
            <button
              onClick={() => handleVote(true)}
              disabled={isVoting}
              className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl bg-accent hover:bg-accent/90 active:bg-accent/80 text-accent-fg font-bold text-base py-4 transition disabled:opacity-50 shadow-lg active:scale-[0.98]"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Tak, nadal aktualne
            </button>
          ) : (
            /* Other user's report: confirm or reject */
            <>
              <button
                onClick={() => handleVote(true)}
                disabled={isVoting}
                className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl bg-accent hover:bg-accent/90 active:bg-accent/80 text-accent-fg font-bold text-base py-4 transition disabled:opacity-50 shadow-lg active:scale-[0.98]"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                PotwierdĹş
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={isVoting}
                className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-base py-4 transition disabled:opacity-50 shadow-lg active:scale-[0.98]"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                OdrzuÄ‡
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
