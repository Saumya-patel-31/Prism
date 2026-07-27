// In-memory sliding-window rate limiter.
// Resets on process restart — fine for self-hosted single-server use.
const store = new Map<string, number[]>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const oldest = Math.min(...hits);
    return { ok: false, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  hits.push(now);
  store.set(key, hits);
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
