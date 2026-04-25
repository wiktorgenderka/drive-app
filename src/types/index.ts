export enum ReportType {
  POLICE = 'POLICE',
  UNMARKED_POLICE = 'UNMARKED_POLICE',
  SPEED_TRAP = 'SPEED_TRAP',
  ACCIDENT = 'ACCIDENT',
  OBSTACLE = 'OBSTACLE',
  SPEED_CAMERA = 'SPEED_CAMERA',
}

export enum FuelType {
  PETROL_95 = 'PETROL_95',
  PETROL_98 = 'PETROL_98',
  DIESEL = 'DIESEL',
  LPG = 'LPG',
}

export enum ConvoyRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export enum FriendshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lastLocationUpdate?: string | null;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  requester?: User;
  addressee?: User;
}

export interface Convoy {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  owner?: User;
  members?: ConvoyMember[];
}

export interface ConvoyMember {
  id: string;
  convoyId: string;
  userId: string;
  role: ConvoyRole;
  joinedAt: string;
  user?: User;
  latitude?: number;
  longitude?: number;
}

export interface Report {
  id: string;
  type: ReportType;
  latitude: number;
  longitude: number;
  description?: string | null;
  createdAt: string;
  expiresAt: string;
  userId: string;
  user?: User;
  votes?: ReportVote[];
  upvotes?: number;
  downvotes?: number;
}

export interface ReportVote {
  id: string;
  reportId: string;
  userId: string;
  isUpvote: boolean;
}

export interface FuelStation {
  id: string;
  name: string;
  brand?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  prices?: FuelPrice[];
}

export interface FuelPrice {
  id: string;
  stationId: string;
  fuelType: FuelType;
  price: number;
  updatedAt: string;
  userId: string;
  user?: User;
}

export interface Route {
  id: string;
  name: string;
  description?: string | null;
  waypoints: Array<{ lat: number; lng: number }>;
  createdAt: string;
  userId: string;
  convoyId?: string | null;
}

export interface RouteTime {
  id: string;
  routeId: string;
  userId: string;
  seconds: number;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'image'>;
}

export interface ThemeConfig {
  mode: 'dark' | 'light';
  accentColor: string;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [ReportType.POLICE]: 'Policja',
  [ReportType.UNMARKED_POLICE]: 'Nieoznakowany radiowóz',
  [ReportType.SPEED_TRAP]: 'Kontrola prędkości',
  [ReportType.ACCIDENT]: 'Wypadek',
  [ReportType.OBSTACLE]: 'Przeszkoda',
  [ReportType.SPEED_CAMERA]: 'Fotoradar',
};

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL_95]: 'Benzyna 95',
  [FuelType.PETROL_98]: 'Benzyna 98',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.LPG]: 'LPG',
};
