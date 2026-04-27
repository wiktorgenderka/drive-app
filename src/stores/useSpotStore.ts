import { create } from 'zustand';
import type { Spot } from '@/types';

interface SpotState {
  spots: Spot[];
}

interface SpotActions {
  setSpots: (spots: Spot[]) => void;
  addSpot: (spot: Spot) => void;
  upsertSpot: (spot: Spot) => void;
  removeSpot: (spotId: string) => void;
  clear: () => void;
}

type SpotStore = SpotState & SpotActions;

export const useSpotStore = create<SpotStore>()((set) => ({
  spots: [],

  setSpots: (spots) => set({ spots }),

  addSpot: (spot) =>
    set((state) =>
      state.spots.some((s) => s.id === spot.id)
        ? state
        : { spots: [...state.spots, spot] }
    ),

  upsertSpot: (spot) =>
    set((state) => ({
      spots: state.spots.some((s) => s.id === spot.id)
        ? state.spots.map((s) => (s.id === spot.id ? spot : s))
        : [...state.spots, spot],
    })),

  removeSpot: (spotId) =>
    set((state) => ({ spots: state.spots.filter((s) => s.id !== spotId) })),

  clear: () => set({ spots: [] }),
}));
