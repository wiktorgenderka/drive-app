'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { calculateDistance, formatDistance } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import AuthGuard from '@/components/auth/AuthGuard';
import { useMapStore } from '@/stores/useMapStore';
import { useConvoyStore } from '@/stores/useConvoyStore';
import Link from 'next/link';
import HomeScreen from '@/components/dashboard/HomeScreen';
import SettingsPanel from '@/components/settings/SettingsPanel';
import FriendsList from '@/components/friends/FriendsList';
import FriendRequests from '@/components/friends/FriendRequests';
import AddFriendModal from '@/components/friends/AddFriendModal';
import ConvoyPanel from '@/components/convoy/ConvoyPanel';
import ConvoyMapVoice from '@/components/convoy/ConvoyMapVoice';
import RoutePanel from '@/components/routes/RoutePanel';
import SocialFeed from '@/components/social/SocialFeed';
import CreateSpotModal from '@/components/spots/CreateSpotModal';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocationPing } from '@/hooks/useLocationPing';
import { useAutoSpotDetection } from '@/hooks/useAutoSpotDetection';
import { useProfileStore } from '@/stores/useProfileStore';
import { UserProfileView } from '@/components/profile/PublicProfileModals';
import { useGeolocation } from '@/hooks/useGeolocation';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <svg className="h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  ),
});

type Tab = 'home' | 'map' | 'profile' | 'car' | 'routes' | 'friends' | 'feed';
type LayerKey = 'showReports' | 'showFuelStations' | 'showConvoyMembers' | 'showSpots';

const LAYER_CONFIG: { key: LayerKey; label: string }[] = [
  { key: 'showReports', label: 'Raporty' },
  { key: 'showFuelStations', label: 'Stacje paliw' },
  { key: 'showConvoyMembers', label: 'Konwój' },
  { key: 'showSpots', label: 'Spoty' },
];

const NAV_ITEMS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  {
    id: 'feed',
    label: 'Społeczność',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    id: 'home',
    label: 'Główna',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-9 9 9" />
        <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profil',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const SECTION_META: Record<Exclude<Tab, 'home' | 'map'>, { title: string; color: string }> = {
  profile: { title: 'Profil', color: 'bg-violet-600' },
  car: { title: 'Konwój', color: 'bg-emerald-600' },
  routes: { title: 'Trasy', color: 'bg-orange-600' },
  friends: { title: 'Znajomi', color: 'bg-pink-600' },
  feed: { title: 'Społeczność', color: 'bg-rose-600' },
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const activeConvoy = useConvoyStore((s) => s.activeConvoy);
  useNotifications({ userId: session?.user?.id, convoyId: activeConvoy?.id });
  const autoSpotEnabled = useProfileStore((s) => s.privacy.autoSpot !== false);
  useLocationPing(true);
  useAutoSpotDetection(autoSpotEnabled);

  // Trzymaj GPS aktywny dopóki użytkownik jest zalogowany — dzięki temu lokalizacja
  // działa też w zakładkach Trasy/Społeczność, nie tylko po wejściu w pełnoekranową mapę.
  const geo = useGeolocation({ enableHighAccuracy: true, autoStart: true });
  const [geoBannerDismissed, setGeoBannerDismissed] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);
  const [createRouteOpen, setCreateRouteOpen] = useState(false);
  const [mapVoiceEnabled, setMapVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('convoy_map_voice') !== 'false';
    }
    return true;
  });
  const [mapNotificationsEnabled, setMapNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('convoy_map_notifications') !== 'false';
    }
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
  const { showReports, showFuelStations, showConvoyMembers, showSpots, toggleLayer } = useMapStore();
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
        body: JSON.stringify({
          type,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }),
      });
    } catch {
      // silent fail
    }
    setShowAddReport(false);
  }, [userLocation]);

  const layerStates: Record<LayerKey, boolean> = {
    showReports,
    showFuelStations,
    showConvoyMembers,
    showSpots,
  };

  const isProfileView = viewedProfileUserId !== null;
  const isMapMode = activeTab === 'map' && !isProfileView;
  const isHome = activeTab === 'home' && !isProfileView;
  const isOverlay = !isHome && !isMapMode && !isProfileView;

  function handleTabClick(tab: Tab) {
    // Każde kliknięcie w dolnej nawigacji zamyka pełnostronicowy widok profilu.
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
      <div className="relative h-screen w-screen overflow-hidden bg-background">

        {/* === GPS STATUS BANNER === */}
        {geo.error && !geoBannerDismissed && (
          <div className="absolute left-1/2 top-3 z-40 w-[min(90vw,420px)] -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-red-300">Lokalizacja niedostępna</p>
                <p className="mt-0.5 text-[11px] leading-4 text-red-200/90">{geo.error}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => geo.startTracking()}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700"
                  >
                    Spróbuj ponownie
                  </button>
                  <button
                    onClick={() => setGeoBannerDismissed(true)}
                    className="rounded-md border border-red-500/40 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/10"
                  >
                    Ukryj
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === HOME SCREEN === */}
        {isHome && (
          <HomeScreen
            onNavigateToMap={() => setActiveTab('map')}
            onNavigateToFriends={() => setActiveTab('friends')}
            onNavigateToRoutes={() => setActiveTab('routes')}
            onNavigateToConvoy={() => setActiveTab('car')}
          />
        )}

        {/* === FULL MAP MODE === */}
        {isMapMode && (
          <>
            <MapView />
            {mapVoiceEnabled && <ConvoyMapVoice onIncomingMessage={handleIncomingConvoyMessage} />}

            {/* Convoy message notification toast */}
            {mapToast && (
              <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200">
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
              </div>
            )}

            {/* Top bar */}
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
                    <span className="text-xs font-bold text-foreground leading-tight">{formatDistance(nearestStationDist)}</span>
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
                      showLayerMenu
                        ? 'bg-blue-600 text-white'
                        : 'bg-card-bg/90 text-muted border border-card-border backdrop-blur-md hover:text-foreground'
                    }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </button>
                  {showLayerMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-card-border bg-card-bg/95 p-2 shadow-xl backdrop-blur-md">
                      {LAYER_CONFIG.map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => toggleLayer(key)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-input-bg"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              layerStates[key]
                                ? 'border-blue-500 bg-blue-600'
                                : 'border-input-border bg-input-bg'
                            }`}
                          >
                            {layerStates[key] && (
                              <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <span className="text-foreground">{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add report */}
                <div className="relative">
                  <button
                    onClick={() => { setShowAddReport(!showAddReport); setShowLayerMenu(false); }}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition ${
                      showAddReport
                        ? 'bg-orange-600 text-white'
                        : 'bg-card-bg/90 text-muted border border-card-border backdrop-blur-md hover:text-foreground'
                    }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 9v3m0 0v3m0-3h3m-3 0H9" />
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </button>
                  {showAddReport && (
                    <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-card-border bg-card-bg/95 p-4 shadow-xl backdrop-blur-md">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Dodaj raport</h3>
                        <button onClick={() => setShowAddReport(false)} className="rounded-lg p-1 text-muted hover:text-foreground">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: 'Policja', type: 'POLICE', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
                          { label: 'Tajniaki', type: 'UNMARKED_POLICE', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
                          { label: 'Kontrola prędkości', type: 'SPEED_TRAP', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
                          { label: 'Wypadek', type: 'ACCIDENT', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
                          { label: 'Zagrożenie', type: 'OBSTACLE', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                          { label: 'Fotoradar', type: 'SPEED_CAMERA', icon: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' },
                        ].map((report) => (
                          <button
                            key={report.label}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition hover:bg-input-bg"
                            onClick={() => submitReport(report.type)}
                          >
                            <svg className="h-4 w-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d={report.icon} />
                            </svg>
                            {report.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
          </>
        )}

        {/* === SECTION OVERLAYS (profile, convoy, routes, friends) === */}
        {isOverlay && (
          <div className="absolute inset-0 z-20 flex flex-col bg-background">
            {/* Header */}
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
              <h2 className="text-lg font-bold text-foreground">
                {SECTION_META[activeTab as keyof typeof SECTION_META].title}
              </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-24">
              {activeTab === 'profile' && <SettingsPanel />}

              {activeTab === 'car' && (
                <div className="rounded-2xl border border-card-border bg-card-bg p-5">
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
                </div>
              )}

              {activeTab === 'routes' && (
                <RoutePanel
                  onShowOnMap={() => setActiveTab('map')}
                  onShowProfile={(uid) => setViewedProfileUserId(uid)}
                  onCreateRouteOpenChange={setCreateRouteOpen}
                />
              )}

              {activeTab === 'feed' && (
                <SocialFeed onShowProfile={(uid) => setViewedProfileUserId(uid)} />
              )}

              {activeTab === 'friends' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">Znajomi</h3>
                    <button
                      onClick={() => setShowAddFriend(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
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

                  <AddFriendModal
                    open={showAddFriend}
                    onClose={() => setShowAddFriend(false)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* === USER PROFILE OVERLAY (full page) === */}
        {isProfileView && viewedProfileUserId && (
          <div className="absolute inset-0 z-20 flex flex-col bg-background">
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
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
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
          </div>
        )}

        <CreateSpotModal
          open={showCreateSpot}
          onClose={() => setShowCreateSpot(false)}
        />

        {/* Bottom nav bar - visible when NOT in full map mode and no fullscreen modal */}
        {!isMapMode && !createRouteOpen && (
          <div className="absolute bottom-0 left-0 right-0 z-30">
            <div className="mx-4 mb-6 flex items-center justify-around rounded-2xl border border-card-border bg-card-bg/95 px-2 py-2 shadow-xl backdrop-blur-md">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-blue-600/15 text-blue-500'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
