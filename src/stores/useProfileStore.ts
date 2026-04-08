import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: string;
  licensePlate: string;
  color: string;
  image: string | null; // base64 JPEG
  isActive: boolean;
}

export interface PrivacySettings {
  shareLocation: boolean;
  showInConvoy: boolean;
  publicProfile: boolean;
  showSpeed: boolean;
}

export interface NotificationSettings {
  nearbyReports: boolean;
  friendRequests: boolean;
  convoyInvites: boolean;
  speedAlerts: boolean;
  policeAlerts: boolean;
}

interface ProfileState {
  vehicles: Vehicle[];
  privacy: PrivacySettings;
  notifications: NotificationSettings;
}

interface ProfileActions {
  addVehicle: (v: Omit<Vehicle, 'id' | 'isActive'>) => void;
  updateVehicle: (id: string, v: Partial<Omit<Vehicle, 'id'>>) => void;
  removeVehicle: (id: string) => void;
  setActiveVehicle: (id: string) => void;
  setPrivacy: (p: Partial<PrivacySettings>) => void;
  setNotifications: (n: Partial<NotificationSettings>) => void;
}

export const useProfileStore = create<ProfileState & ProfileActions>()(
  persist(
    (set) => ({
      vehicles: [],
      privacy: { shareLocation: true, showInConvoy: true, publicProfile: false, showSpeed: true },
      notifications: { nearbyReports: true, friendRequests: true, convoyInvites: true, speedAlerts: true, policeAlerts: true },

      addVehicle: (v) =>
        set((s) => ({
          vehicles: [
            ...s.vehicles.map((x) => ({ ...x, isActive: false })),
            { ...v, id: crypto.randomUUID(), isActive: true },
          ],
        })),

      updateVehicle: (id, v) =>
        set((s) => ({
          vehicles: s.vehicles.map((x) => (x.id === id ? { ...x, ...v } : x)),
        })),

      removeVehicle: (id) =>
        set((s) => {
          const remaining = s.vehicles.filter((x) => x.id !== id);
          if (remaining.length > 0 && !remaining.some((x) => x.isActive)) {
            remaining[0].isActive = true;
          }
          return { vehicles: remaining };
        }),

      setActiveVehicle: (id) =>
        set((s) => ({
          vehicles: s.vehicles.map((x) => ({ ...x, isActive: x.id === id })),
        })),

      setPrivacy: (p) => set((s) => ({ privacy: { ...s.privacy, ...p } })),
      setNotifications: (n) => set((s) => ({ notifications: { ...s.notifications, ...n } })),
    }),
    { name: 'drive-app-profile' }
  )
);
