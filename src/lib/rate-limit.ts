/**
 * Counts failed attempts per key (e.g. client address + email) in a time window.
 *
 * Best effort only: the counts live in this server instance's memory, so on a
 * serverless host each warm instance counts separately and a cold start resets
 * them. It slows down guessing; it does not make guessing impossible, so use a
 * long password.
 */
export function createFailureLimiter(maxFailures: number, windowMs: number) {
  const entries = new Map<string, { count: number; resetAt: number }>();

  function live(key: string, now: number) {
    const entry = entries.get(key);
    if (entry && entry.resetAt > now) return entry;
    entries.delete(key);
    return undefined;
  }

  return {
    /** Seconds the caller must wait, or 0 if it may try. */
    retryAfterSeconds(key: string, now: number = Date.now()): number {
      const entry = live(key, now);
      return entry && entry.count >= maxFailures ? Math.ceil((entry.resetAt - now) / 1000) : 0;
    },
    recordFailure(key: string, now: number = Date.now()): void {
      const entry = live(key, now) ?? { count: 0, resetAt: now + windowMs };
      entry.count += 1;
      entries.set(key, entry);
      // Keep memory bounded: drop expired entries once the map grows.
      if (entries.size > 5000) for (const k of entries.keys()) live(k, now);
    },
    reset(key: string): void {
      entries.delete(key);
    },
  };
}
