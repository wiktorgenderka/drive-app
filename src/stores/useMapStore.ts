import { create } from 'zustand';

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface ConvoyMember {
  id: string;
  name: string;
  avatarUrl?: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  lastUpdated: number;
}

export interface Report {
  id: string;
  type: 'police' | 'accident' | 'hazard' | 'traffic' | 'closure' | 'other' | string;
  latitude: number;
  longitude: number;
  description?: string;
  createdBy: string;
  createdAt: string | number;
  expiresAt: string | number;
  upvotes: number;
  downvotes: number;
  userVote?: boolean | null; // true = upvoted, false = downvoted, null = not voted
  isOwner?: boolean;
  confirmedAt?: string | number | null;
}

export interface FuelStation {
  id: string;
  name: string;
  brand?: string;
  address?: string;
  latitude: number;
  longitude: number;
  prices: FuelPrice[];
  lastUpdated: number;
  isMapbox?: boolean;
}

export interface FuelPrice {
  id: string;
  fuelType: string;
  price: number;
  currency?: string;
  updatedAt: number;
}

export interface RouteWaypoint {
  longitude: number;
  latitude: number;
  label?: string;
}

export interface Route {
  id: string;
  name?: string;
  coordinates: [number, number][];
  waypoints?: RouteWaypoint[];
  distance: number;
  duration: number;
  isActive: boolean;
}

export interface NavigationRoute {
  id: string;
  name: string;
  waypoints: { latitude: number; longitude: number; label?: string }[];
}

// Tryb "tajemniczego przejazdu" (jak w Need for Speed) — gracz nie widzi
// całej trasy, tylko najbliższe N checkpointów na mapie. Po dojeździe do
// pierwszego, kolejny pojawia się na mapie.
export type MysteryDriveStatus = 'countdown' | 'running' | 'finished' | 'cancelled';

export interface MysteryDrive {
  routeId: string;
  routeName: string;
  waypoints: { latitude: number; longitude: number; label?: string }[];
  currentIdx: number;
  visibleAhead: number;
  countdown: number | null;
  startedAt: number | null;
  status: MysteryDriveStatus;
  savedSeconds: number | null;
}

interface MapState {
  viewState: ViewState;
  userLocation: UserLocation | null;
  convoyMembers: ConvoyMember[];
  reports: Report[];
  fuelStations: FuelStation[];
  routes: Route[];
  selectedReport: Report | null;
  selectedStation: FuelStation | null;
  showReports: boolean;
  showFuelStations: boolean;
  showConvoyMembers: boolean;
  showSpots: boolean;
  mapFlyTarget: { longitude: number; latitude: number; zoom: number } | null;
  navigationRoute: NavigationRoute | null;
  mysteryDrive: MysteryDrive | null;
}

interface MapActions {
  setViewState: (viewState: Partial<ViewState>) => void;
  setUserLocation: (location: UserLocation) => void;
  addReport: (report: Report) => void;
  removeReport: (reportId: string) => void;
  updateReportVotes: (reportId: string, upvotes: number, downvotes: number, userVote?: boolean | null) => void;
  setReports: (reports: Report[]) => void;
  updateConvoyMember: (member: ConvoyMember) => void;
  removeConvoyMember: (memberId: string) => void;
  setConvoyMembers: (members: ConvoyMember[]) => void;
  setFuelStations: (stations: FuelStation[]) => void;
  updateFuelStation: (station: FuelStation) => void;
  addRoute: (route: Route) => void;
  removeRoute: (routeId: string) => void;
  setActiveRoute: (routeId: string) => void;
  setRoutes: (routes: Route[]) => void;
  setSelectedReport: (report: Report | null) => void;
  setSelectedStation: (station: FuelStation | null) => void;
  toggleLayer: (layer: 'showReports' | 'showFuelStations' | 'showConvoyMembers' | 'showSpots') => void;
  setMapFlyTarget: (target: { longitude: number; latitude: number; zoom: number } | null) => void;
  setNavigationRoute: (route: NavigationRoute | null) => void;
  startMysteryDrive: (config: { routeId: string; routeName: string; waypoints: { latitude: number; longitude: number; label?: string }[]; visibleAhead?: number }) => void;
  setMysteryCountdown: (n: number | null) => void;
  beginMysteryRun: () => void;
  advanceMysteryCheckpoint: () => void;
  finishMysteryDrive: (seconds: number) => void;
  cancelMysteryDrive: () => void;
  clearMysteryDrive: () => void;
  clearAll: () => void;
}

type MapStore = MapState & MapActions;

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: 19.9449,
  latitude: 50.0647,
  zoom: 12,
  pitch: 0,
  bearing: 0,
};

export const useMapStore = create<MapStore>()((set) => ({
  viewState: DEFAULT_VIEW_STATE,
  userLocation: null,
  convoyMembers: [],
  reports: [],
  fuelStations: [],
  routes: [],
  selectedReport: null,
  selectedStation: null,
  showReports: true,
  showFuelStations: true,
  showConvoyMembers: true,
  showSpots: true,
  mapFlyTarget: null,
  navigationRoute: null,
  mysteryDrive: null,

  setViewState: (viewState) =>
    set((state) => ({
      viewState: { ...state.viewState, ...viewState },
    })),

  setUserLocation: (location) =>
    set({ userLocation: location }),

  addReport: (report) =>
    set((state) => ({
      reports: [...state.reports.filter((r) => r.id !== report.id), report],
    })),

  removeReport: (reportId) =>
    set((state) => ({
      reports: state.reports.filter((r) => r.id !== reportId),
      selectedReport:
        state.selectedReport?.id === reportId ? null : state.selectedReport,
    })),

  updateReportVotes: (reportId, upvotes, downvotes, userVote) =>
    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId ? { ...r, upvotes, downvotes, userVote: userVote ?? r.userVote } : r
      ),
      selectedReport:
        state.selectedReport?.id === reportId
          ? { ...state.selectedReport, upvotes, downvotes, userVote: userVote ?? state.selectedReport.userVote }
          : state.selectedReport,
    })),

  setReports: (reports) => set({ reports }),

  updateConvoyMember: (member) =>
    set((state) => ({
      convoyMembers: state.convoyMembers.some((m) => m.id === member.id)
        ? state.convoyMembers.map((m) => (m.id === member.id ? member : m))
        : [...state.convoyMembers, member],
    })),

  removeConvoyMember: (memberId) =>
    set((state) => ({
      convoyMembers: state.convoyMembers.filter((m) => m.id !== memberId),
    })),

  setConvoyMembers: (members) => set({ convoyMembers: members }),

  setFuelStations: (stations) => set({ fuelStations: stations }),

  updateFuelStation: (station) =>
    set((state) => ({
      fuelStations: state.fuelStations.some((s) => s.id === station.id)
        ? state.fuelStations.map((s) => (s.id === station.id ? station : s))
        : [...state.fuelStations, station],
      selectedStation:
        state.selectedStation?.id === station.id ? station : state.selectedStation,
    })),

  addRoute: (route) =>
    set((state) => ({
      routes: [...state.routes, route],
    })),

  removeRoute: (routeId) =>
    set((state) => ({
      routes: state.routes.filter((r) => r.id !== routeId),
    })),

  setActiveRoute: (routeId) =>
    set((state) => ({
      routes: state.routes.map((r) => ({
        ...r,
        isActive: r.id === routeId,
      })),
    })),

  setRoutes: (routes) => set({ routes }),

  setSelectedReport: (report) => set({ selectedReport: report }),

  setSelectedStation: (station) => set({ selectedStation: station }),

  toggleLayer: (layer) =>
    set((state) => ({
      [layer]: !state[layer],
    })),

  setMapFlyTarget: (target) => set({ mapFlyTarget: target }),

  setNavigationRoute: (route) => set({ navigationRoute: route }),

  startMysteryDrive: ({ routeId, routeName, waypoints, visibleAhead = 3 }) =>
    set({
      mysteryDrive: {
        routeId,
        routeName,
        waypoints,
        currentIdx: 0,
        visibleAhead,
        countdown: 5,
        startedAt: null,
        status: 'countdown',
        savedSeconds: null,
      },
    }),

  setMysteryCountdown: (n) =>
    set((state) =>
      state.mysteryDrive
        ? { mysteryDrive: { ...state.mysteryDrive, countdown: n } }
        : state
    ),

  beginMysteryRun: () =>
    set((state) =>
      state.mysteryDrive
        ? {
            mysteryDrive: {
              ...state.mysteryDrive,
              countdown: null,
              startedAt: Date.now(),
              status: 'running',
            },
          }
        : state
    ),

  advanceMysteryCheckpoint: () =>
    set((state) => {
      if (!state.mysteryDrive || state.mysteryDrive.status !== 'running') return state;
      const next = state.mysteryDrive.currentIdx + 1;
      return {
        mysteryDrive: { ...state.mysteryDrive, currentIdx: next },
      };
    }),

  finishMysteryDrive: (seconds) =>
    set((state) =>
      state.mysteryDrive
        ? {
            mysteryDrive: {
              ...state.mysteryDrive,
              status: 'finished',
              savedSeconds: seconds,
            },
          }
        : state
    ),

  cancelMysteryDrive: () =>
    set((state) =>
      state.mysteryDrive
        ? { mysteryDrive: { ...state.mysteryDrive, status: 'cancelled' } }
        : state
    ),

  clearMysteryDrive: () => set({ mysteryDrive: null }),

  clearAll: () =>
    set({
      convoyMembers: [],
      reports: [],
      fuelStations: [],
      routes: [],
      selectedReport: null,
      selectedStation: null,
    }),
}));
