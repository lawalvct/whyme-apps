// Exponential backoff with full jitter (OFF04), honouring the server's Retry-After.

export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
  minMs: number;
}

export const defaultBackoff: BackoffOptions = { baseMs: 2_000, maxMs: 5 * 60_000, minMs: 1_000 };

export function backoffDelay(
  attempts: number,
  random: () => number,
  options: BackoffOptions = defaultBackoff,
  retryAfterMs?: number,
): number {
  const ceiling = Math.min(options.maxMs, options.baseMs * 2 ** Math.max(0, attempts - 1));
  const jittered = Math.max(options.minMs, Math.floor(random() * ceiling));
  return retryAfterMs !== undefined ? Math.max(jittered, retryAfterMs) : jittered;
}
