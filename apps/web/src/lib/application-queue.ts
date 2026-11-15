'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { OutboxAction } from '@whyme/sync';
import { UPLOAD_ENTITY, type Route } from './listing-queue';
import { useAccountRuntime } from './offline';
import type { WebSync } from './sync';

/**
 * Job applications queued offline (JOB04, OFF05, AT08, AT11):
 * - If the seeker picked a new PDF/DOCX CV file while offline, `upload.cv_file` uploads it
 *   to `/v1/uploads` (`purpose: 'cv_document'`) and `cv.attach` attaches it via `/v1/me/cvs/upload`.
 * - Then `application.submit` sends `POST /v1/jobs/{vacancy}/apply` with `client_id` and
 *   `client_created_at`. If the vacancy closed or its deadline passed meanwhile (422 `job_closed`),
 *   the action stays in `rejected` state so the seeker's draft and cover note are preserved.
 */

export const APPLICATION_ENTITY = 'job_application';
export const CV_ENTITY = 'cv';

export interface CvFileUploadPayload {
  client_id: string;
  file: Blob;
  name: string;
}

export interface CvAttachQueuePayload {
  upload_action_id: string;
  title: string;
}

export interface ApplicationQueuePayload {
  client_id: string;
  client_created_at: string;
  vacancy_id: string;
  vacancy_slug: string | null;
  vacancy_title: string;
  company_name: string;
  cv_id: string | null;
  cv_attach_action_id: string | null;
  cv_title: string;
  cover_note: string | null;
  savedAt: number;
}

export const applicationRoutes: Record<string, Route> = {
  'upload.cv_file': (action) => {
    const payload = action.payload as CvFileUploadPayload;
    if (!(payload.file instanceof Blob)) throw new Error('cv file missing');
    const form = new FormData();
    form.append('purpose', 'cv_document');
    form.append('client_id', payload.client_id);
    form.append('file', payload.file, payload.name);
    return { method: 'POST', path: '/v1/uploads', body: form };
  },

  'cv.attach': (action, ctx) => {
    const payload = action.payload as CvAttachQueuePayload;
    const uploadId = ctx.serverIdFor(payload.upload_action_id);
    if (!uploadId) throw new Error('cv upload missing');
    return {
      method: 'POST',
      path: '/v1/me/cvs/upload',
      body: {
        upload_id: uploadId,
        title: payload.title,
      },
    };
  },

  'application.submit': (action, ctx) => {
    const payload = action.payload as ApplicationQueuePayload;
    const cvId = payload.cv_id ?? (payload.cv_attach_action_id ? ctx.serverIdFor(payload.cv_attach_action_id) : null);
    if (!cvId) throw new Error('cv missing');
    return {
      method: 'POST',
      path: `/v1/jobs/${encodeURIComponent(payload.vacancy_id)}/apply`,
      body: {
        client_id: payload.client_id,
        client_created_at: payload.client_created_at,
        cv_id: cvId,
        cover_note: payload.cover_note,
      },
    };
  },
};

export function useQueuedApplications(vacancyId?: string): OutboxAction[] | undefined {
  const sync = useAccountRuntime();
  return useLiveQuery(async () => {
    if (!sync) return [];
    const all = await sync.db.outbox.where('accountId').equals(sync.accountId).toArray();
    return all
      .filter(
        (a) =>
          a.entityType === APPLICATION_ENTITY &&
          a.state !== 'acked' &&
          (!vacancyId || a.localId === vacancyId),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [sync, vacancyId]);
}

export async function queueJobApplication(
  sync: WebSync,
  input: {
    vacancy_id: string;
    vacancy_slug: string | null;
    vacancy_title: string;
    company_name: string;
    cv_id: string | null;
    cv_title: string;
    cvFile?: File | null;
    cover_note: string | null;
    client_created_at?: string;
  },
): Promise<OutboxAction> {
  const existing = (await sync.engine.unsent()).find(
    (a) => a.entityType === APPLICATION_ENTITY && a.localId === input.vacancy_id,
  );
  const existingPayload = existing?.payload as ApplicationQueuePayload | undefined;

  let cvAttachActionId: string | null = existingPayload?.cv_attach_action_id ?? null;
  let cvId: string | null = input.cv_id;
  let cvTitle = input.cv_title;

  if (input.cvFile) {
    const fileTitle = input.cvFile.name.replace(/\.(pdf|docx)$/i, '').slice(0, 120) || 'Uploaded CV';
    cvTitle = fileTitle;
    cvId = null;

    const uploadAction = await sync.engine.enqueue({
      entityType: UPLOAD_ENTITY,
      localId: crypto.randomUUID(),
      actionType: 'upload.cv_file',
      payload: {
        client_id: crypto.randomUUID(),
        file: input.cvFile,
        name: input.cvFile.name,
      } satisfies CvFileUploadPayload,
    });

    const attachAction = await sync.engine.enqueue({
      entityType: CV_ENTITY,
      localId: uploadAction.localId,
      actionType: 'cv.attach',
      payload: {
        upload_action_id: uploadAction.actionId,
        title: fileTitle,
      } satisfies CvAttachQueuePayload,
      dependsOn: [uploadAction.actionId],
    });

    cvAttachActionId = attachAction.actionId;
  }

  const payload: ApplicationQueuePayload = {
    client_id: existingPayload?.client_id ?? crypto.randomUUID(),
    client_created_at: existingPayload?.client_created_at ?? input.client_created_at ?? new Date().toISOString(),
    vacancy_id: input.vacancy_id,
    vacancy_slug: input.vacancy_slug,
    vacancy_title: input.vacancy_title,
    company_name: input.company_name,
    cv_id: cvId,
    cv_attach_action_id: cvAttachActionId,
    cv_title: cvTitle,
    cover_note: input.cover_note,
    savedAt: Date.now(),
  };

  const dependsOn = cvAttachActionId ? [cvAttachActionId] : [];

  if (existing && (await sync.engine.revise(existing.actionId, { payload, dependsOn }))) {
    await sync.controller.refresh().catch(() => undefined);
    if (navigator.onLine) void sync.controller.run().catch(() => undefined);
    return existing;
  }

  const created = await sync.engine.enqueue({
    entityType: APPLICATION_ENTITY,
    localId: input.vacancy_id,
    actionType: 'application.submit',
    payload,
    dependsOn,
  });

  await sync.controller.refresh().catch(() => undefined);
  if (navigator.onLine) void sync.controller.run().catch(() => undefined);
  return created;
}

export async function discardQueuedApplication(sync: WebSync, actionId: string): Promise<void> {
  const action = await sync.db.outbox.get(actionId);
  await sync.engine.discard(actionId);
  if (action) {
    for (const depId of action.dependsOn) {
      const dep = await sync.db.outbox.get(depId);
      if (dep && dep.state !== 'acked') {
        for (const subDepId of dep.dependsOn) {
          await sync.engine.discard(subDepId);
        }
        await sync.engine.discard(depId);
      }
    }
  }
  await sync.controller.refresh().catch(() => undefined);
}
