import { backoffDelay, defaultBackoff, type BackoffOptions } from './backoff';
import type { OutboxAction, OutboxStore, SendContext, Transport, TransportResult } from './types';
import { uuidv7 } from './uuid';

export interface EnqueueInput {
  entityType: string;
  localId: string;
  actionType: string;
  payload: unknown;
  payloadVersion?: number;
  baseVersion?: number | null;
  dependsOn?: string[];
}

export interface SyncEngineOptions {
  store: OutboxStore;
  transport: Transport;
  accountId: string;
  now?: () => number;
  random?: () => number;
  newId?: () => string;
  backoff?: BackoffOptions;
  /** Called after every state change, e.g. to refresh UI badges. */
  onChange?: (action: OutboxAction) => void;
}

export type RunResult =
  | { status: 'busy' }
  | { status: 'unreachable' }
  | { status: 'paused_auth'; sent: number }
  | { status: 'offline'; sent: number }
  | { status: 'done'; sent: number; failed: number };

type SendOutcome = 'acked' | 'retry' | 'offline' | 'auth' | 'conflict' | 'rejected' | 'gone';

/**
 * Durable action queue. Every user action is written to the store before the UI
 * says "saved", then replayed through the API with its actionId as the
 * Idempotency-Key, so a retry after a lost response never duplicates work.
 */
export class SyncEngine {
  private running = false;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly newId: () => string;
  private readonly backoff: BackoffOptions;

  constructor(private readonly options: SyncEngineOptions) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.newId = options.newId ?? (() => uuidv7(this.now()));
    this.backoff = options.backoff ?? defaultBackoff;
  }

  /** Persists the action. Only after this resolves may the UI say "Saved offline". */
  async enqueue(input: EnqueueInput): Promise<OutboxAction> {
    const action: OutboxAction = {
      actionId: this.newId(),
      accountId: this.options.accountId,
      entityType: input.entityType,
      localId: input.localId,
      serverId: null,
      actionType: input.actionType,
      payloadVersion: input.payloadVersion ?? 1,
      payload: input.payload,
      baseVersion: input.baseVersion ?? null,
      dependsOn: input.dependsOn ?? [],
      state: 'queued',
      attempts: 0,
      nextRetryAt: null,
      lastErrorCode: null,
      lastResponse: null,
      createdAt: this.now(),
      ackedAt: null,
    };
    await this.options.store.put(action);
    this.options.onChange?.(action);
    return action;
  }

  /** Call on app start: anything left "sending" by a crash or force-stop is queued again. */
  async recover(): Promise<number> {
    let recovered = 0;
    for (const action of await this.all()) {
      if (action.state === 'sending') {
        await this.patch(action, { state: 'queued' });
        recovered++;
      }
    }
    return recovered;
  }

  /** Everything not yet confirmed by the server, oldest first. */
  async unsent(): Promise<OutboxAction[]> {
    return (await this.all()).filter((a) => a.state !== 'acked');
  }

  /** Sends every eligible action once. Safe to call often: concurrent calls return "busy". */
  async run(): Promise<RunResult> {
    if (this.running) return { status: 'busy' };
    this.running = true;
    try {
      if (!(await this.options.transport.isReachable())) return { status: 'unreachable' };

      const attempted = new Set<string>();
      let sent = 0;
      let failed = 0;
      for (;;) {
        const next = await this.nextEligible(attempted);
        if (!next) break;
        attempted.add(next.actionId);
        const outcome = await this.sendOne(next);
        if (outcome === 'acked') sent++;
        else if (outcome === 'gone') continue;
        else if (outcome === 'auth') return { status: 'paused_auth', sent };
        else if (outcome === 'offline') return { status: 'offline', sent };
        else failed++;
      }
      return { status: 'done', sent, failed };
    } finally {
      this.running = false;
    }
  }

  /** Manual "Retry" button: send at the next run instead of waiting for the backoff. */
  async retryNow(actionId: string): Promise<void> {
    const action = await this.options.store.get(actionId);
    if (action && action.state === 'retry_wait') await this.patch(action, { state: 'queued', nextRetryAt: null });
  }

  /** After the user signs in again, release everything paused by a 401. */
  async resumeAfterAuth(): Promise<void> {
    for (const action of await this.all()) {
      if (action.state === 'needs_auth') await this.patch(action, { state: 'queued' });
    }
  }

  /**
   * The user fixed a rejected or conflicting draft. The actionId stays the same:
   * the server only stores idempotency results for successful requests.
   */
  async amend(actionId: string, changes: { payload: unknown; baseVersion?: number | null }): Promise<void> {
    const action = await this.options.store.get(actionId);
    if (!action || (action.state !== 'rejected' && action.state !== 'conflict')) return;
    await this.patch(action, {
      payload: changes.payload,
      baseVersion: changes.baseVersion ?? action.baseVersion,
      state: 'queued',
      lastErrorCode: null,
      lastResponse: null,
      nextRetryAt: null,
    });
  }

  /**
   * The user changed something still waiting in the queue, e.g. saved an offline
   * draft again. It is changed in place only while that's safe: never sent yet,
   * or refused by the server (which stores only successes). Returns false when
   * it is being sent, was acked, or an earlier attempt may have reached the
   * server with the reply lost: the same Idempotency-Key with a new body would
   * be refused, so queue a follow-up action that depends on it instead.
   */
  async revise(
    actionId: string,
    changes: { payload: unknown; baseVersion?: number | null; dependsOn?: string[] },
  ): Promise<boolean> {
    const patch: Partial<OutboxAction> = {
      payload: changes.payload,
      ...(changes.baseVersion === undefined ? {} : { baseVersion: changes.baseVersion }),
      ...(changes.dependsOn ? { dependsOn: changes.dependsOn } : {}),
      state: 'queued',
      lastErrorCode: null,
      lastResponse: null,
      nextRetryAt: null,
    };
    const changed = await this.updateIf(actionId, isRevisable, patch);
    if (changed) {
      const action = await this.options.store.get(actionId);
      if (action) this.options.onChange?.(action);
    }
    return changed;
  }

  /** The user chose to throw this draft away. */
  async discard(actionId: string): Promise<void> {
    await this.options.store.delete(actionId);
  }

  /**
   * Deletes actions acked more than `olderThanMs` ago, except those an unsent
   * action still depends on (it needs their server IDs and responses).
   */
  async prune(olderThanMs: number): Promise<number> {
    const all = await this.all();
    const needed = new Set(all.filter((a) => a.state !== 'acked').flatMap((a) => a.dependsOn));
    const cutoff = this.now() - olderThanMs;
    let removed = 0;
    for (const action of all) {
      if (action.state === 'acked' && (action.ackedAt ?? 0) < cutoff && !needed.has(action.actionId)) {
        await this.options.store.delete(action.actionId);
        removed++;
      }
    }
    return removed;
  }

  private async all(): Promise<OutboxAction[]> {
    const list = await this.options.store.list(this.options.accountId);
    return list.sort(compareCreated);
  }

  private async nextEligible(attempted: Set<string>): Promise<OutboxAction | undefined> {
    const all = await this.all();
    const byId = new Map(all.map((a) => [a.actionId, a]));
    const now = this.now();

    return all.find((a) => {
      if (attempted.has(a.actionId)) return false;
      const ready = a.state === 'queued' || (a.state === 'retry_wait' && (a.nextRetryAt ?? 0) <= now);
      if (!ready) return false;
      // A dependency missing from the store was acked and pruned, so it counts as done.
      const depsDone = a.dependsOn.every((id) => {
        const dep = byId.get(id);
        return dep === undefined || dep.state === 'acked';
      });
      if (!depsDone) return false;
      // First-in, first-out per entity: an earlier unfinished action on the same record goes first.
      return !all.some(
        (b) =>
          b.entityType === a.entityType &&
          b.localId === a.localId &&
          b.state !== 'acked' &&
          compareCreated(b, a) < 0,
      );
    });
  }

  private async sendOne(listed: OutboxAction): Promise<SendOutcome> {
    const attempts = listed.attempts + 1;
    // Claim it, then send what's stored now: another tab may have revised the
    // payload since it was listed, or discarded it.
    const claimed = await this.updateIf(listed.actionId, (a) => a.state === listed.state, { state: 'sending', attempts });
    const action = claimed ? await this.options.store.get(listed.actionId) : undefined;
    if (!action) return 'gone';
    this.options.onChange?.({ ...action });

    let result: TransportResult;
    try {
      result = await this.options.transport.send({ ...action }, await this.context());
    } catch {
      result = { kind: 'retryable', code: 'network_error' };
    }

    switch (result.kind) {
      case 'ok':
        await this.patch(action, {
          state: 'acked',
          ackedAt: this.now(),
          serverId: result.serverId ?? action.serverId,
          lastErrorCode: null,
          lastResponse: result.body ?? null,
          nextRetryAt: null,
        });
        return 'acked';
      case 'retryable':
        await this.patch(action, {
          state: 'retry_wait',
          nextRetryAt: this.now() + backoffDelay(attempts, this.random, this.backoff, result.retryAfterMs),
          lastErrorCode: result.code,
        });
        return result.code === 'network_error' ? 'offline' : 'retry';
      case 'auth':
        await this.patch(action, { state: 'needs_auth', lastErrorCode: 'unauthenticated' });
        return 'auth';
      case 'conflict':
        await this.patch(action, { state: 'conflict', lastErrorCode: result.code, lastResponse: result.body ?? null });
        return 'conflict';
      case 'rejected':
        await this.patch(action, { state: 'rejected', lastErrorCode: result.code, lastResponse: result.body ?? null });
        return 'rejected';
    }
  }

  private async context(): Promise<SendContext> {
    const byId = new Map((await this.all()).map((a) => [a.actionId, a]));
    const acked = (actionId: string) => {
      const action = byId.get(actionId);
      return action?.state === 'acked' ? action : undefined;
    };
    return {
      serverIdFor: (actionId) => acked(actionId)?.serverId ?? null,
      responseFor: (actionId) => acked(actionId)?.lastResponse ?? null,
    };
  }

  private async updateIf(actionId: string, test: (action: OutboxAction) => boolean, patch: Partial<OutboxAction>): Promise<boolean> {
    const { store } = this.options;
    if (store.updateIf) return store.updateIf(actionId, test, patch);
    const current = await store.get(actionId);
    if (!current || !test(current)) return false;
    await store.update(actionId, patch);
    return true;
  }

  private async patch(action: OutboxAction, changes: Partial<OutboxAction>): Promise<void> {
    await this.options.store.update(action.actionId, changes);
    Object.assign(action, changes);
    this.options.onChange?.({ ...action });
  }
}

function isRevisable(action: OutboxAction): boolean {
  return (action.state === 'queued' && action.attempts === 0) || action.state === 'rejected' || action.state === 'conflict';
}

function compareCreated(a: OutboxAction, b: OutboxAction): number {
  return a.createdAt - b.createdAt || (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0);
}
