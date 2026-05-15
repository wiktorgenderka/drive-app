import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  CreateReportSchema,
  CreateConvoySchema,
  SendFriendRequestSchema,
  CreateRouteSchema,
  SubmitFuelPriceSchema,
} from '@/lib/schemas';

describe('RegisterSchema', () => {
  it('accepts valid data', () => {
    const result = RegisterSchema.safeParse({ email: 'test@example.com', name: 'Jan Kowalski', password: 'Password1' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = RegisterSchema.safeParse({ email: 'not-an-email', name: 'Jan', password: 'Password1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    const result = RegisterSchema.safeParse({ email: 'a@b.com', name: 'Jan', password: 'password1' });
    expect(result.success).toBe(false);
  });

  it('rejects password without digit', () => {
    const result = RegisterSchema.safeParse({ email: 'a@b.com', name: 'Jan', password: 'Password' });
    expect(result.success).toBe(false);
  });

  it('rejects name shorter than 2 chars', () => {
    const result = RegisterSchema.safeParse({ email: 'a@b.com', name: 'J', password: 'Password1' });
    expect(result.success).toBe(false);
  });
});

describe('CreateReportSchema', () => {
  it('accepts valid police report', () => {
    const r = CreateReportSchema.safeParse({ type: 'POLICE', latitude: 52.23, longitude: 21.01 });
    expect(r.success).toBe(true);
  });

  it('rejects invalid report type', () => {
    const r = CreateReportSchema.safeParse({ type: 'UNKNOWN', latitude: 0, longitude: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects latitude out of range', () => {
    const r = CreateReportSchema.safeParse({ type: 'POLICE', latitude: 100, longitude: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects description longer than 500 chars', () => {
    const r = CreateReportSchema.safeParse({ type: 'POLICE', latitude: 0, longitude: 0, description: 'x'.repeat(501) });
    expect(r.success).toBe(false);
  });
});

describe('CreateRouteSchema', () => {
  const validWaypoints = [
    { latitude: 52.23, longitude: 21.01 },
    { latitude: 50.06, longitude: 19.94 },
  ];

  it('accepts route with 2+ waypoints', () => {
    const r = CreateRouteSchema.safeParse({ name: 'Test', waypoints: validWaypoints });
    expect(r.success).toBe(true);
  });

  it('rejects route with fewer than 2 waypoints', () => {
    const r = CreateRouteSchema.safeParse({ name: 'Test', waypoints: [validWaypoints[0]] });
    expect(r.success).toBe(false);
  });

  it('rejects empty name', () => {
    const r = CreateRouteSchema.safeParse({ name: '', waypoints: validWaypoints });
    expect(r.success).toBe(false);
  });
});

describe('SendFriendRequestSchema', () => {
  it('accepts email', () => {
    const r = SendFriendRequestSchema.safeParse({ email: 'friend@example.com' });
    expect(r.success).toBe(true);
  });

  it('accepts userId', () => {
    const r = SendFriendRequestSchema.safeParse({ userId: 'user123' });
    expect(r.success).toBe(true);
  });

  it('rejects empty object', () => {
    const r = SendFriendRequestSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('SubmitFuelPriceSchema', () => {
  it('accepts valid fuel price', () => {
    const r = SubmitFuelPriceSchema.safeParse({ stationId: 'station1', fuelType: 'PETROL_95', price: 6.5 });
    expect(r.success).toBe(true);
  });

  it('rejects negative price', () => {
    const r = SubmitFuelPriceSchema.safeParse({ stationId: 'station1', fuelType: 'PETROL_95', price: -1 });
    expect(r.success).toBe(false);
  });

  it('rejects invalid fuel type', () => {
    const r = SubmitFuelPriceSchema.safeParse({ stationId: 'station1', fuelType: 'HYDROGEN', price: 5 });
    expect(r.success).toBe(false);
  });
});
