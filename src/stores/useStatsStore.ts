import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TripStats {
  totalKm: number;
  maxSpeedKmh: number;
  totalTrips: number;
  totalMinutes: number;
}

const empty = (): TripStats => ({ totalKm: 0, maxSpeedKmh: 0, totalTrips: 0, totalMinutes: 0 });

interface StatsState {
  overall: TripStats;
  byVehicle: Record<string, TripStats>;
}

interface StatsActions {
  recordTrip: (vehicleId: string | null, data: { km: number; maxSpeedKmh: number; minutes: number }) => void;
  resetVehicle: (vehicleId: string) => void;
}

export const useStatsStore = create<StatsState & StatsActions>()(
  persist(
    (set) => ({
      overall: empty(),
      byVehicle: {},

      recordTrip: (vehicleId, { km, maxSpeedKmh, minutes }) =>
        set((s) => {
          const merge = (prev: TripStats): TripStats => ({
            totalKm: prev.totalKm + km,
            maxSpeedKmh: Math.max(prev.maxSpeedKmh, maxSpeedKmh),
            totalTrips: prev.totalTrips + 1,
            totalMinutes: prev.totalMinutes + minutes,
          });

          const nextByVehicle = { ...s.byVehicle };
          if (vehicleId) {
            nextByVehicle[vehicleId] = merge(nextByVehicle[vehicleId] ?? empty());
          }

          return {
            overall: merge(s.overall),
            byVehicle: nextByVehicle,
          };
        }),

      resetVehicle: (vehicleId) =>
        set((s) => {
          const { [vehicleId]: _, ...rest } = s.byVehicle;
          return { byVehicle: rest };
        }),
    }),
    { name: 'drive-app-stats' }
  )
);
