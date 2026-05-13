'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateDistance, formatDistance } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/components/auth/AuthGuard';
import { useMapStore } from '@/stores/useMapStore';
import { useConvoyStore } from '@/stores/useConvoyStore';
import HomeScreen from '@/components/dashboard/HomeScreen';
import SettingsPanel from '@/components/settings/SettingsPanel';
import FriendsList from '@/components/friends/FriendsList';
import FriendRequests from '@/components/friends/FriendRequests';
import AddFriendModal from '@/components/friends/AddFriendModal';
import ConvoyPanel from '@/components/convoy/ConvoyPanel';
import ConvoyMapVoice from '@/components/convoy/ConvoyMapVoice';
import RoutePanel from '@/components/routes/RoutePanel';
import SocialFeed from '@/components/social/SocialFeed';
import GaragePanel from '@/components/garage/GaragePanel';
import EventPanel from '@/components/events/EventPanel';
import OnboardingFlow, { useShowOnboarding } from '@/components/onboarding/OnboardingFlow';
import GlobalSearch from '@/components/search/GlobalSearch';
import TripHistoryPanel from '@/components/trips/TripHistoryPanel';
import CreateSpotModal from '@/components/spots/CreateSpotModal';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocationPing } from '@/hooks/useLocationPing';
import { useAutoSpotDetection } from '@/hooks/useAutoSpotDetection';
import { useProfileStore } from '@/stores/useProfileStore';
import { UserProfileView } from '@/components/profile/PublicProfileModals';
import { useGeolocation } from '@/hooks/useGeolocation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import Link from 'next/link';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-accent/30" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
        </div>
        <span className="text-xs text-muted">Ładowanie mapy…</span>
      </div>
    </div>
  ),
});

type Tab = 'home' | 'map' | 'profile' | 'car' | 'routes' | 'friends' | 'feed';
type LayerKey = 'showReports' | 'showFuelStations' | 'showConvoyMembers' | 'showSpots' | 'showFriends';

const LAYER_CONFIG: { key: LayerKey; label: string }[] = [
  { key: 'showReports', label: 'Raporty' },
  { key: 'showFuelStations', label: 'Stacje paliw' },
  { key: 'showConvoyMembers', label: 'Konwój' },
  { key: 'showSpots', label: 'Spoty' },
  { key: 'showFriends', label: 'Znajomi' },
];

// Bottom nav — 5 głównych tabów
const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  {
    id: 'home',
    label: 'Główna',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-9 9 9" /><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Mapa',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: 'car',
    label: 'Konwój',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    id: 'routes',
    label: 'Trasy',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    id: 'feed',
    label: 'Społeczność',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const SECTION_META: Record<Exclude<Tab, 'home' | 'map'>, { title: string; color: string }> = {
  profile: { title: 'Profil', color: 'bg-violet-600' },
  car:     { title: 'Konwój', color: 'bg-emerald-600' },
  routes:  { title: 'Trasy',  color: 'bg-accent' },
  friends: { title: 'Znajomi', color: 'bg-pink-600' },
  feed:    { title: 'Społeczność', color: 'bg-rose-600' },
};

const sectionVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 28 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const activeConvoy = useConvoyStore((s) => s.activeConvoy);
  useNotifications({ userId: session?.user?.id, convoyId: activeConvoy?.id });
  const autoSpotEnabled = useProfileStore((s) => s.privacy.autoSpot !== false);
  useLocationPing(true);
  useAutoSpotDetection(autoSpotEnabled);

  const geo = useGeolocation({ enableHighAccuracy: true, autoStart: true });
  const [geoBannerDismissed, setGeoBannerDismissed] = useState(false);

  const initialTab = (() => {
    const t = searchParams?.get('tab');
    if (t === 'map' || t === 'car' || t === 'routes' || t === 'friends' || t === 'feed' || t === 'profile') return t as Tab;
    return 'home' as Tab;
  })();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [carSubTab, setCarSubTab] = useState<'convoy' | 'garage'>('convoy');
  const [feedSubTab, setFeedSubTab] = useState<'feed' | 'events'>('feed');
  const { show: showOnboarding, dismiss: dismissOnboarding } = useShowOnboarding();
  const [searchOpen, setSearchOpen] = useState(false);
  const [routesSubTab, setRoutesSubTab] = useState<'routes' | 'trips'>('routes');

  // Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [mapVoiceEnabled, setMapVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('convoy_map_voice') !== 'false';
    return true;
  });
  const [mapNotificationsEnabled, setMapNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('convoy_map_notifications') !== 'false';
    return true;
  });
  const [mapToast, setMapToast] = useState<{ name: string; type: 'text' | 'voice' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleMapVoice(val: boolean) {
    setMapVoiceEnabled(val);
    localStorage.setItem('convoy_map_voice', String(val));
  }

  function toggleMapNotifications(val: boolean) {
    setMapNotificationsEnabled(val);
    localStorage.setItem('convoy_map_notifications', String(val));
  }

  const handleIncomingConvoyMessage = useCallback((msg: { name: string; type: 'text' | 'voice' }) => {
    if (!mapNotificationsEnabled) return;
    setMapToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setMapToast(null), 3500);
  }, [mapNotificationsEnabled]);

  const { showReports, showFuelStations, showConvoyMembers, showSpots, showFriends, toggleLayer } = useMapStore();
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showAddReport, setShowAddReport] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateSpot, setShowCreateSpot] = useState(false);
  const userLocation = useMapStore((s) => s.userLocation);
  const fuelStations = useMapStore((s) => s.fuelStations);

  const nearestStationDist = useMemo(() => {
    if (!userLocation || fuelStations.length === 0) return null;
    let min = Infinity;
    for (const s of fuelStations) {
      const d = calculateDistance(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude);
      if (d < min) min = d;
    }
    return min === Infinity ? null : min;
  }, [userLocation, fuelStations]);

  const submitReport = useCallback(async (type: string) => {
    if (!userLocation) return;
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, latitude: userLocation.latitude, longitude: userLocation.longitude }),
      });
    } catch { /* silent */ }
    setShowAddReport(false);
  }, [userLocation]);

  const layerStates: Record<LayerKey, boolean> = {
    showReports, showFuelStations, showConvoyMembers, showSpots, showFriends,
  };

  const isProfileView = viewedProfileUserId !== null;
  const isMapMode = activeTab === 'map' && !isProfileView;
  const isHome = activeTab === 'home' && !isProfileView;
  const isOverlay = !isHome && !isMapMode && !isProfileView;

  function handleTabClick(tab: Tab) {
    if ('vibrate' in navigator) navigator.vibrate(8);
    if (viewedProfileUserId !== null) setViewedProfileUserId(null);
    if (tab === activeTab && viewedProfileUserId === null) {
      setActiveTab('home');
    } else {
      setActiveTab(tab);
      setShowLayerMenu(false);
      setShowAddReport(false);
    }
  }

  return (
    <AuthGuard>
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingFlow onDone={dismissOnboarding} />
        )}
      </AnimatePresence>
      <div className="relative h-screen w-screen overflow-hidden bg-background">

        {/* GPS STATUS BANNER */}
        <AnimatePresence>
          {geo.error && !geoBannerDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="absolute left-1/2 top-3 z-40 w-[min(90vw,420px)] -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 shadow-lg backdrop-blur-md"
            >
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-red-300">Lokalizacja niedostępna</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-red-200/90">{geo.error}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => geo.startTracking()} className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700">
                      Spróbuj ponownie
                    </button>
                    <button onClick={() => setGeoBannerDismissed(true)} className="rounded-md border border-red-500/40 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/10">
                      Ukryj
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HOME SCREEN */}
        <AnimatePresence mode="wait">
          {isHome && (
            <motion.div
              key="home"
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0"
            >
              <HomeScreen
                onNavigateToMap={() => setActiveTab('map')}
                onNavigateToFriends={() => setActiveTab('friends')}
                onNavigateToRoutes={() => setActiveTab('routes')}
                onNavigateToConvoy={() => setActiveTab('car')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* FULL MAP MODE */}
        {isMapMode && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <MapView />
            {mapVoiceEnabled && <ConvoyMapVoice onIncomingMessage={handleIncomingConvoyMessage} />}

            {/* Convoy message toast */}
            <AnimatePresence>
              {mapToast && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="absolute left-1/2 top-20 z-30 -translate-x-1/2"
                >
                  <div className="flex items-center gap-2 rounded-2xl border border-card-border bg-card-bg/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400">
                      {mapToast.type === 'voice' ? (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground">{mapToast.name}</span>
                      <span className="ml-1.5 text-xs text-muted">
                        {mapToast.type === 'voice' ? 'wysłał głosówkę' : 'napisał wiadomość'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Map top bar */}
            <div className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-4">
              <div className="flex flex-col items-start gap-1.5">
                <button
                  onClick={() => setActiveTab('home')}
                  className="flex items-center gap-2 rounded-xl bg-card-bg/90 px-3 py-2 shadow-lg backdrop-blur-md border border-card-border transition hover:bg-card-bg"
                >
                  <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-semibold text-foreground">Mapa</span>
                </button>

                {nearestStationDist !== null && (
                  <div className="flex flex-col items-center rounded-xl bg-card-bg/90 px-3 py-2 shadow-lg backdrop-blur-md border border-card-border">
                    <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                    </svg>
                    <span className="text-xs font-bold text-foreground leading-tight tabular-nums">{formatDistance(nearestStationDist)}</span>
                    <span className="text-[10px] text-muted leading-tight">do stacji</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Layer toggle */}
                <div className="relative">
                  <button
                    onClick={() => { setShowLayerMenu(!showLayerMenu); setShowAddReport(false); }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition ${
                      showLayerMenu ? 'bg-blue-600 text-white' : 'bg-card-bg/90 text-muted border border-card-border backdrop-blur-md hover:text-foreground'
                    }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {showLayerMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-card-border bg-card-bg/95 p-2 shadow-xl backdrop-blur-md"
                      >
                        {LAYER_CONFIG.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => toggleLayer(key)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-input-bg"
                          >
                            <span className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                              layerStates[key] ? 'border-accent bg-accent' : 'border-input-border bg-input-bg'
                            }`}>
                              {layerStates[key] && (
                                <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            <span className="text-foreground">{label}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Add report */}
                <div className="relative">
                  <button
                    onClick={() => { setShowAddReport(!showAddReport); setShowLayerMenu(false); }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition ${
                      showAddReport ? 'bg-orange-600 text-white' : 'bg-card-bg/90 text-muted border border-card-border backdrop-blur-md hover:text-foreground'
                    }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 9v3m0 0v3m0-3h3m-3 0H9" />
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {showAddReport && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-card-border bg-card-bg/95 p-4 shadow-xl backdrop-blur-md"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-foreground">Dodaj raport</h3>
                          <button onClick={() => setShowAddReport(false)} className="rounded-lg p-1 text-muted hover:text-foreground">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          {[
                            { label: 'Policja', type: 'POLICE', emoji: '🚔' },
                            { label: 'Tajniaki', type: 'UNMARKED_POLICE', emoji: '🕵️' },
                            { label: 'Kontrola prędkości', type: 'SPEED_TRAP', emoji: '📏' },
                            { label: 'Wypadek', type: 'ACCIDENT', emoji: '🚨' },
                            { label: 'Zagrożenie', type: 'OBSTACLE', emoji: '⚠️' },
                            { label: 'Fotoradar', type: 'SPEED_CAMERA', emoji: '📷' },
                          ].map((report) => (
                            <button
                              key={report.type}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition hover:bg-input-bg"
                              onClick={() => submitReport(report.type)}
                            >
                              <span className="text-base">{report.emoji}</span>
                              {report.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Create spot */}
                <button
                  onClick={() => { setShowCreateSpot(true); setShowAddReport(false); setShowLayerMenu(false); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-bg/90 text-muted border border-card-border backdrop-blur-md shadow-lg transition hover:text-foreground"
                  title="Stwórz spot"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </button>

                <Link
                  href="/settings"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-bg/90 shadow-lg backdrop-blur-md border border-card-border text-muted transition hover:text-foreground"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* SECTION OVERLAYS */}
        <AnimatePresence mode="wait">
          {isOverlay && (
            <motion.div
              key={activeTab}
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 z-20 flex flex-col bg-background"
            >
              {/* Section header */}
              <div className="flex items-center gap-3 px-5 pt-6 pb-4">
                <button
                  onClick={() => setActiveTab('home')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted transition hover:text-foreground"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${SECTION_META[activeTab as keyof typeof SECTION_META].color} text-white`}>
                  {NAV_ITEMS.find((n) => n.id === activeTab)?.icon}
                </div>
                <h2 className="flex-1 text-lg font-bold text-foreground">
                  {SECTION_META[activeTab as keyof typeof SECTION_META].title}
                </h2>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted transition hover:text-foreground"
                  title="Szukaj (Ctrl+K)"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 pb-28">
                {activeTab === 'profile' && <SettingsPanel />}

                {activeTab === 'car' && (
                  <div className="flex flex-col gap-4">
                    {/* Sub-tabs */}
                    <div className="flex rounded-xl bg-input-bg p-1">
                      {(['convoy', 'garage'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setCarSubTab(t)}
                          className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition ${carSubTab === t ? 'text-foreground' : 'text-muted hover:text-foreground'}`}
                        >
                          {carSubTab === t && (
                            <motion.div
                              layoutId="car-sub-pill"
                              className="absolute inset-0 rounded-lg bg-card-bg shadow"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className="relative">
                            {t === 'convoy' ? '👥 Konwój' : '🚗 Garaż'}
                          </span>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {carSubTab === 'convoy' ? (
                        <motion.div
                          key="convoy"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          transition={{ duration: 0.15 }}
                          className="rounded-2xl border border-card-border bg-card-bg p-5"
                        >
                          <ConvoyPanel
                            mapVoiceEnabled={mapVoiceEnabled}
                            onToggleMapVoice={toggleMapVoice}
                            mapNotificationsEnabled={mapNotificationsEnabled}
                            onToggleMapNotifications={toggleMapNotifications}
                            onEnterDriveMode={() => {
                              if (!mapVoiceEnabled) toggleMapVoice(true);
                              setActiveTab('map');
                            }}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="garage"
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.15 }}
                        >
                          <GaragePanel />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {activeTab === 'routes' && (
                  <div className="flex flex-col gap-4">
                    {/* Sub-tabs: Trasy / Historia */}
                    <div className="flex rounded-xl bg-input-bg p-1">
                      {(['routes', 'trips'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setRoutesSubTab(t)}
                          className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition ${routesSubTab === t ? 'text-foreground' : 'text-muted hover:text-foreground'}`}
                        >
                          {routesSubTab === t && (
                            <motion.div
                              layoutId="routes-sub-pill"
                              className="absolute inset-0 rounded-lg bg-card-bg shadow"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className="relative">
                            {t === 'routes' ? '🗺️ Trasy' : '🏁 Historia jazdy'}
                          </span>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {routesSubTab === 'routes' ? (
                        <motion.div key="routes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                          <RoutePanel
                            onShowOnMap={() => setActiveTab('map')}
                            onShowProfile={(uid) => setViewedProfileUserId(uid)}
                            onCreateRouteOpenChange={setCreateRouteOpen}
                          />
                        </motion.div>
                      ) : (
                        <motion.div key="trips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                          <TripHistoryPanel />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {activeTab === 'feed' && (
                  <div className="flex flex-col gap-4">
                    {/* Sub-tabs */}
                    <div className="flex rounded-xl bg-input-bg p-1">
                      {(['feed', 'events'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setFeedSubTab(t)}
                          className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition ${feedSubTab === t ? 'text-foreground' : 'text-muted hover:text-foreground'}`}
                        >
                          {feedSubTab === t && (
                            <motion.div
                              layoutId="feed-sub-pill"
                              className="absolute inset-0 rounded-lg bg-card-bg shadow"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className="relative">
                            {t === 'feed' ? '📰 Aktywność' : '🏁 Eventy'}
                          </span>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {feedSubTab === 'feed' ? (
                        <motion.div
                          key="feed"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -12 }}
                          transition={{ duration: 0.15 }}
                        >
                          <SocialFeed onShowProfile={(uid) => setViewedProfileUserId(uid)} />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="events"
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.15 }}
                        >
                          <EventPanel />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {activeTab === 'friends' && (
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-foreground">Znajomi</h3>
                      <button
                        onClick={() => setShowAddFriend(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Dodaj
                      </button>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-muted">Zaproszenia</h4>
                      <FriendRequests />
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-muted">Lista znajomych</h4>
                      <FriendsList />
                    </div>
                    <AddFriendModal open={showAddFriend} onClose={() => setShowAddFriend(false)} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* USER PROFILE OVERLAY */}
        <AnimatePresence>
          {isProfileView && viewedProfileUserId && (
            <motion.div
              key="profile-view"
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="absolute inset-0 z-25 flex flex-col bg-background"
            >
              <div className="flex items-center gap-3 px-5 pt-6 pb-4">
                <button
                  onClick={() => setViewedProfileUserId(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted transition hover:text-foreground"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-foreground">Profil</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-24">
                <div className="mx-auto w-full max-w-2xl">
                  <UserProfileView
                    key={viewedProfileUserId}
                    userId={viewedProfileUserId}
                    onBack={() => setViewedProfileUserId(null)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <CreateSpotModal open={showCreateSpot} onClose={() => setShowCreateSpot(false)} />

        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onShowProfile={(uid) => { setViewedProfileUserId(uid); setSearchOpen(false); }}
        />

        {/* BOTTOM NAV — 5 tabów */}
        {!isMapMode && !createRouteOpen && (
          <div className="absolute bottom-0 left-0 right-0 z-30">
            <div className="mx-3 mb-5 overflow-hidden rounded-2xl border border-card-border bg-card-bg/95 shadow-2xl backdrop-blur-xl">
              {/* accent line on top */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
              <div className="flex items-center justify-around px-1 py-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className="relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-200"
                    >
                      {/* Active background pill */}
                      {isActive && (
                        <motion.div
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-xl bg-accent/12"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className={`relative transition-colors duration-200 ${isActive ? 'text-accent' : 'text-muted'}`}>
                        {item.icon}
                      </span>
                      <span className={`relative text-[10px] font-medium transition-colors duration-200 ${isActive ? 'text-accent' : 'text-muted'}`}>
                        {item.label}
                      </span>
                      {/* Active dot */}
                      {isActive && (
                        <motion.div
                          layoutId="nav-dot"
                          className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
