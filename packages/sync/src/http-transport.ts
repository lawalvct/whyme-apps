import type { OutboxAction, SendContext, Transport, TransportResult } from './types';

export interface RouteSpec {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
}

export interface HttpTransportOptions {
  /** e.g. "https://api.example.com/api/v1" */
  baseUrl: string;
  /** Maps each actionType to the API call that performs it. */
  routes: Record<string, (action: OutboxAction, ctx: SendContext) => RouteSpec>;
  /** Authorization, Accept-Language, X-App-Version, X-Platform … */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** "include" on the website (Sanctum cookie session); omit on mobile (bearer token). */
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
  healthPath?: string;
  timeoutMs?: number;
}

/** Sends outbox actions through the normal REST API and classifies the response (OFF04). */
export function createHttpTransport(options: HttpTransportOptions): Transport {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function request(path: string, init: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await doFetch(`${options.baseUrl}${path}`, {
        ...init,
        credentials: options.credentials,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async isReachable() {
      try {
        const res = await request(options.healthPath ?? '/health', { method: 'GET' }, 5_000);
        return res.ok;
      } catch {
        return false;
      }
    },

    async send(action, ctx): Promise<TransportResult> {
      const route = options.routes[action.actionType];
      if (!route) return { kind: 'rejected', code: 'unknown_action' };
      const spec = route(action, ctx);

      let res: Response;
      try {
        res = await request(
          spec.path,
          {
            method: spec.method,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'Idempotency-Key': action.actionId,
              'X-Payload-Version': String(action.payloadVersion),
              ...(await options.headers?.()),
            },
            body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
          },
          timeoutMs,
        );
      } catch {
        return { kind: 'retryable', code: 'network_error' };
      }

      const body = await res.json().catch(() => null);
      return classify(res.status, body, res.headers.get('Retry-After'));
    },
  };
}

export function classify(status: number, body: unknown, retryAfter: string | null): TransportResult {
  const code = errorCode(body) ?? `http_${status}`;
  if (status >= 200 && status < 300) return { kind: 'ok', serverId: serverId(body), body };
  if (status === 401) return { kind: 'auth' };
  if (status === 409) {
    return code === 'idempotency_mismatch' ? { kind: 'rejected', code, body } : { kind: 'conflict', code, body };
  }
  if (status === 408 || status === 425 || status === 429 || status >= 500) {
    return { kind: 'retryable', code, retryAfterMs: parseRetryAfter(retryAfter) };
  }
  return { kind: 'rejected', code, body };
}

function errorCode(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') return body.code;
  return undefined;
}

function serverId(body: unknown): string | null {
  if (body && typeof body === 'object' && 'data' in body) {
    const data = (body as { data: unknown }).data;
    if (data && typeof data === 'object' && 'id' in data) return String((data as { id: unknown }).id);
  }
  return null;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
