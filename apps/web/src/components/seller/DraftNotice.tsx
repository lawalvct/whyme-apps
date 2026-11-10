'use client';

import { ApiRequestError } from '@whyme/data';
import { useT } from '@/lib/i18n';
import type { DraftStatus } from '@/lib/record-drafts';
import type { OutboxAction } from '@whyme/sync';
import { Notice, useErrorText } from './common';

type FormNotice = { tone: 'success' | 'info' | 'error'; text: string } | null;

/**
 * What happened to a record's queued saves (listing or business/provider page). A problem
 * (refused, changed elsewhere) shows over the form's own notice; "waiting" shows only when
 * there's nothing newer to say.
 */
export function DraftNotice({
  draft,
  fallback,
}: {
  draft: { unsent: OutboxAction[]; status: DraftStatus | null; problem: OutboxAction | null; publishQueued: boolean } | null;
  fallback: FormNotice;
}) {
  const { t } = useT('seller');
  const errorText = useErrorText();
  const status = draft && draft.unsent.length > 0 ? draft.status : null;
  let problem: { tone: 'info' | 'error'; text: string } | null = null;
  if (status === 'conflict') problem = { tone: 'info', text: t('offline.conflict') };
  else if (status === 'in_review') problem = { tone: 'info', text: t('offline.inReview') };
  else if (status === 'rejected') {
    const reason = errorText(new ApiRequestError(422, draft?.problem?.lastResponse as never));
    problem = { tone: 'error', text: t('offline.rejected', { reason }) };
  } else if (status === 'photo_rejected') problem = { tone: 'error', text: t('offline.photoRejected') };
  else if (status === 'needs_auth') problem = { tone: 'error', text: t('offline.needsAuth') };

  const waiting = draft?.publishQueued ? t('offline.waitingPublish') : t('offline.waiting');
  const shown =
    problem ??
    fallback ??
    (status === 'sending' ? { tone: 'info' as const, text: t('offline.sending') } : status === 'waiting' ? { tone: 'info' as const, text: waiting } : null);
  return shown ? <Notice tone={shown.tone}>{shown.text}</Notice> : null;
}
