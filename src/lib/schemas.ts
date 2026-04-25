import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email').max(255),
  name: z.string().min(2, 'Imię musi mieć min 2 znaki').max(50).trim(),
  password: z
    .string()
    .min(8, 'Hasło musi mieć min 8 znaków')
    .max(100)
    .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
    .regex(/[0-9]/, 'Hasło musi zawierać cyfrę'),
});

// ─── Reports ─────────────────────────────────────────────────────────────────

export const CreateReportSchema = z.object({
  type: z.enum(['POLICE', 'UNMARKED_POLICE', 'SPEED_TRAP', 'ACCIDENT', 'OBSTACLE', 'SPEED_CAMERA']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().max(500).optional(),
});

// ─── Convoy ───────────────────────────────────────────────────────────────────

export const CreateConvoySchema = z.object({
  name: z.string().min(2, 'Nazwa musi mieć min 2 znaki').max(50).trim(),
});

export const UpdateConvoySchema = z.object({
  name: z.string().min(2).max(50).trim(),
  destLat: z.number().min(-90).max(90).optional(),
  destLng: z.number().min(-180).max(180).optional(),
  destName: z.string().max(200).optional(),
});

// ─── Friends ─────────────────────────────────────────────────────────────────

export const SendFriendRequestSchema = z
  .object({
    email: z.string().email('Nieprawidłowy adres email').optional(),
    userId: z.string().min(1).optional(),
  })
  .refine((d) => !!d.email || !!d.userId, {
    message: 'Wymagany email lub userId',
  });

export const RespondFriendSchema = z.object({
  friendshipId: z.string().min(1),
  action: z.enum(['accept', 'reject']),
});

// ─── Fuel ─────────────────────────────────────────────────────────────────────

export const SubmitFuelPriceSchema = z.object({
  stationId: z.string().min(1),
  fuelType: z.enum(['PETROL_95', 'PETROL_98', 'DIESEL', 'LPG']),
  price: z.number().min(0.01).max(50),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

const WaypointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().max(200).optional(),
});

export const CreateRouteSchema = z.object({
  name: z.string().min(1, 'Nazwa trasy jest wymagana').max(100).trim(),
  description: z.string().max(500).optional(),
  waypoints: z.array(WaypointSchema).min(2, 'Trasa wymaga co najmniej 2 punktów'),
  isPublic: z.boolean().optional(),
});

export const UpdateRouteSchema = z.object({
  isPublic: z.boolean().optional(),
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
});

// ─── User profile ────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  image: z
    .string()
    .refine((url) => {
      try {
        const u = new URL(url);
        return ['http:', 'https:'].includes(u.protocol);
      } catch {
        return false;
      }
    }, 'Nieprawidłowy URL obrazu')
    .optional(),
  carDisplay: z.string().max(80).trim().optional().nullable(),
  bio: z.string().max(280).trim().optional().nullable(),
});

export const DeleteAccountSchema = z.object({
  password: z.string().min(1, 'Hasło jest wymagane'),
});

// ─── Trips ───────────────────────────────────────────────────────────────────

export const CreateTripSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  distanceKm: z.number().min(0).max(10000),
  maxSpeedKmh: z.number().min(0).max(400),
  avgSpeedKmh: z.number().min(0).max(400),
  durationMin: z.number().int().min(0),
  vehicleId: z.string().optional(),
  convoyId: z.string().optional(),
});
