import 'server-only';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Entry = { count: number; firstAt: number };
const attempts = new Map<string, Entry>();

export function checkAttempts(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 0, firstAt: now });
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
  return {
    allowed: entry.count < MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - entry.count),
  };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
