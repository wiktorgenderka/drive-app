// In-memory sliding window rate limiter
// Działa na poziomie Node.js API routes (nie Edge Runtime)

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Czyść stare wpisy co 5 minut żeby nie rosnął bez końca
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 60_000) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * @param key     identyfikator (np. IP adres)
 * @param limit   maksymalna liczba requestów w oknie
 * @param windowMs okno czasowe w milisekundach
 * @returns true jeśli request jest dozwolony, false jeśli przekroczono limit
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Usuń timestampy spoza okna
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    store.set(key, entry);
    return false;
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return true;
}
