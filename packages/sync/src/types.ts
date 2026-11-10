// Outbox model shared by web (IndexedDB) and mobile (SQLite). See docs/01 §6 and PRD OFF03.

export type OutboxState =
  | 'queued' // waiting to be sent
  | 'sending' // in flight; reset to queued by recover() after a crash
  | 'acked' // the server confirmed it (2xx or idempotent replay)
  | 'retry_wait' // transient failure; next attempt at nextRetryAt
  | 'needs_auth' // 401: paused until the user signs in again
  | 'conflict' // 409: the record changed elsewhere; user must review
  | 'rejected'; // 4xx: server refused it; draft kept with the reason

export interface OutboxAction {
  /** UUIDv7 created when the user taps; sent as the Idempotency-Key header. */
  actionId: string;
  accountId: string;
  entityType: string;
  localId: string;
  serverId: string | null;
  /** e.g. "request.submit". The transport maps it to an endpoint. */
  actionType: string;
  payloadVersion: number;
  payload: unknown;
  /** Record version the edit was based on (optimistic concurrency, OFF06). */
  baseVersion: number | null;
  /** Actions that must be acked first (uploads → create → update). */
  dependsOn: string[];
  state: OutboxState;
  attempts: number;
  nextRetryAt: number | null;
  lastErrorCode: string | null;
  /**
   * Server body: the saved record once acked (a follow-up action reads its new
   * version from here), the current record or field errors for conflict/rejected.
   */
  lastResponse: unknown;
  createdAt: number;
  ackedAt: number | null;
}

export interface OutboxStore {
  put(action: OutboxAction): Promise<void>;
  get(actionId: string): Promise<OutboxAction | undefined>;
  list(accountId: string): Promise<OutboxAction[]>;
  update(actionId: string, patch: Partial<OutboxAction>): Promise<void>;
  /**
   * Applies the patch only if `test` still passes, in one transaction, and says
   * whether it did. Lets a tab change a waiting action without racing the tab
   * that is sending the queue. Stores without it fall back to get + update.
   */
  updateIf?(actionId: string, test: (action: OutboxAction) => boolean, patch: Partial<OutboxAction>): Promise<boolean>;
  delete(actionId: string): Promise<void>;
}

export type TransportResult =
  | { kind: 'ok'; serverId?: string | null; body?: unknown }
  | { kind: 'retryable'; code: string; retryAfterMs?: number }
  | { kind: 'auth' }
  | { kind: 'conflict'; code: string; body?: unknown }
  | { kind: 'rejected'; code: string; body?: unknown };

export interface SendContext {
  /** Server ID of an earlier acked action, e.g. an upload this action references. */
  serverIdFor(actionId: string): string | null;
  /** Response body of an earlier acked action, e.g. the record version a follow-up edit is based on. */
  responseFor(actionId: string): unknown;
}

export interface Transport {
  send(action: OutboxAction, ctx: SendContext): Promise<TransportResult>;
  /** A network connection is not proof the backend is reachable (OFF03). */
  isReachable(): Promise<boolean>;
}
