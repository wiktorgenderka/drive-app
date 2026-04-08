import { create } from 'zustand';

export interface ConvoyMemberInfo {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  role: 'leader' | 'member';
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  joinedAt: number;
  lastUpdated: number;
  isOnline: boolean;
}

export interface Convoy {
  id: string;
  name: string;
  code: string;
  leaderId: string;
  createdAt: number;
  destination?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}

export interface ConvoyInvitation {
  id: string;
  convoyId: string;
  convoyName: string;
  invitedBy: string;
  invitedByName: string;
  createdAt: number;
  expiresAt: number;
}

interface ConvoyState {
  activeConvoy: Convoy | null;
  members: ConvoyMemberInfo[];
  invitations: ConvoyInvitation[];
  isCreating: boolean;
  isJoining: boolean;
  error: string | null;
}

interface ConvoyActions {
  createConvoy: (name: string, destination?: Convoy['destination']) => void;
  setActiveConvoy: (convoy: Convoy | null) => void;
  joinConvoy: (code: string) => void;
  leaveConvoy: () => void;
  updateMemberLocation: (
    memberId: string,
    latitude: number,
    longitude: number,
    heading?: number | null,
    speed?: number | null
  ) => void;
  setMembers: (members: ConvoyMemberInfo[]) => void;
  addMember: (member: ConvoyMemberInfo) => void;
  removeMember: (memberId: string) => void;
  setMemberOnlineStatus: (memberId: string, isOnline: boolean) => void;
  addInvitation: (invitation: ConvoyInvitation) => void;
  removeInvitation: (invitationId: string) => void;
  setInvitations: (invitations: ConvoyInvitation[]) => void;
  setCreating: (isCreating: boolean) => void;
  setJoining: (isJoining: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type ConvoyStore = ConvoyState & ConvoyActions;

const initialState: ConvoyState = {
  activeConvoy: null,
  members: [],
  invitations: [],
  isCreating: false,
  isJoining: false,
  error: null,
};

export const useConvoyStore = create<ConvoyStore>()((set) => ({
  ...initialState,

  createConvoy: (_name, _destination) =>
    set({
      isCreating: true,
      error: null,
      activeConvoy: null,
    }),

  setActiveConvoy: (convoy) =>
    set({
      activeConvoy: convoy,
      isCreating: false,
      isJoining: false,
      error: null,
    }),

  joinConvoy: (_code) =>
    set({
      isJoining: true,
      error: null,
    }),

  leaveConvoy: () =>
    set({
      activeConvoy: null,
      members: [],
      error: null,
    }),

  updateMemberLocation: (memberId, latitude, longitude, heading, speed) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              latitude,
              longitude,
              heading: heading ?? m.heading,
              speed: speed ?? m.speed,
              lastUpdated: Date.now(),
            }
          : m
      ),
    })),

  setMembers: (members) => set({ members }),

  addMember: (member) =>
    set((state) => ({
      members: state.members.some((m) => m.id === member.id)
        ? state.members.map((m) => (m.id === member.id ? member : m))
        : [...state.members, member],
    })),

  removeMember: (memberId) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== memberId),
    })),

  setMemberOnlineStatus: (memberId, isOnline) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, isOnline } : m
      ),
    })),

  addInvitation: (invitation) =>
    set((state) => ({
      invitations: [...state.invitations, invitation],
    })),

  removeInvitation: (invitationId) =>
    set((state) => ({
      invitations: state.invitations.filter((i) => i.id !== invitationId),
    })),

  setInvitations: (invitations) => set({ invitations }),

  setCreating: (isCreating) => set({ isCreating }),

  setJoining: (isJoining) => set({ isJoining }),

  setError: (error) =>
    set({ error, isCreating: false, isJoining: false }),

  reset: () => set(initialState),
}));
