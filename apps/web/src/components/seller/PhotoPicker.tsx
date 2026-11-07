'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ApiRequestError, useApi, type OwnerPhoto } from '@whyme/data';
import { cn } from '@/components/ui/cn';
import { useT } from '@/lib/i18n';
import { shrinkPhoto, uploadPhoto, waitForUpload } from '@/lib/uploads';

type PhotoState = 'uploading' | 'processing' | 'ready' | 'rejected' | 'failed';

export interface PhotoItem {
  /** Stable React key: the upload's client ID while uploading, then kept. */
  key: string;
  /** The upload ID from the API, once the file has arrived. */
  id: string | null;
  state: PhotoState;
  preview: string | null;
  /** Kept so a failed upload can be retried with the same client ID (idempotent). */
  file?: Blob;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

function fromServer(photos: readonly OwnerPhoto[]): PhotoItem[] {
  return photos.map((p) => ({
    key: p.id,
    id: p.id,
    state: p.status === 'rejected' ? 'rejected' : p.status === 'processing' ? 'processing' : 'ready',
    preview: p.urls.thumb ?? p.urls.medium,
  }));
}

/**
 * A gallery being edited: photos upload as soon as they're picked (shrunk in
 * the browser first), and the form saves only the upload IDs in display order.
 */
export function usePhotoList(initial: readonly OwnerPhoto[], limit: number, single = false) {
  const api = useApi();
  const [items, setItems] = useState<PhotoItem[]>(() => fromServer(initial));
  const [saved, setSaved] = useState<string[]>(() => initial.map((p) => p.id));
  const [notice, setNotice] = useState<string | null>(null);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const patch = useCallback((key: string, change: Partial<PhotoItem>) => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const send = useCallback(
    async (key: string, file: Blob) => {
      patch(key, { state: 'uploading' });
      try {
        let upload = await uploadPhoto(file, key);
        patch(key, { id: upload.id, state: upload.status === 'processing' ? 'processing' : upload.status === 'ready' ? 'ready' : 'rejected' });
        if (upload.status === 'processing') upload = await waitForUpload(api, upload.id);
        patch(key, { state: upload.status === 'ready' ? 'ready' : upload.status === 'rejected' ? 'rejected' : 'processing' });
      } catch (e) {
        // Still processing after a minute is fine: the API waits for it on publish.
        if (e instanceof ApiRequestError && e.code === 'photos_processing') return;
        patch(key, { state: 'failed' });
      }
    },
    [api, patch],
  );

  /** Replaces the list with what the server has (after loading or saving). */
  const reset = useCallback((photos: readonly OwnerPhoto[]) => {
    const next = fromServer(photos);
    setItems(next);
    setSaved(next.map((p) => p.id ?? ''));
    setNotice(null);
  }, []);

  const add = useCallback(
    (files: File[]) => {
      setNotice(null);
      const usable = files.filter((f) => ACCEPTED.includes(f.type));
      if (usable.length < files.length) setNotice('photoType');

      const room = single ? 1 : limit - items.length;
      if (usable.length > room) setNotice('photoLimit');
      const picked = usable.slice(0, Math.max(room, 0));
      if (picked.length === 0) return;

      const added = picked.map((file) => {
        const preview = URL.createObjectURL(file);
        objectUrls.current.add(preview);
        return { key: crypto.randomUUID(), id: null, state: 'uploading' as const, preview, file: file as Blob };
      });
      setItems((list) => (single ? added : [...list, ...added]));

      for (const item of added) {
        void (async () => {
          const shrunk = await shrinkPhoto(item.file as File);
          patch(item.key, { file: shrunk });
          await send(item.key, shrunk);
        })();
      }
    },
    [items.length, limit, single, patch, send],
  );

  const retry = useCallback(
    (key: string) => {
      const item = items.find((i) => i.key === key);
      if (item?.file) void send(key, item.file);
    },
    [items, send],
  );

  const remove = useCallback((key: string) => {
    setNotice(null);
    setItems((list) => list.filter((item) => item.key !== key));
  }, []);

  const move = useCallback((key: string, by: -1 | 1) => {
    setItems((list) => {
      const from = list.findIndex((item) => item.key === key);
      const to = from + by;
      if (from < 0 || to < 0 || to >= list.length) return list;
      const next = [...list];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);

  const ids = items.filter((i) => i.id && i.state !== 'failed').map((i) => i.id as string);

  return {
    items,
    ids,
    limit: single ? 1 : limit,
    single,
    notice,
    /** Still sending: the form waits, so the IDs it saves are complete. */
    busy: items.some((i) => i.state === 'uploading'),
    dirty: ids.join(',') !== saved.join(','),
    add,
    retry,
    remove,
    move,
    reset,
  };
}

export type PhotoList = ReturnType<typeof usePhotoList>;

/**
 * Square tiles with cover, reorder and remove controls; 48px targets throughout.
 * `readOnly` (e.g. while a moderator is checking it) shows the photos only.
 */
export function PhotoPicker({
  photos,
  label,
  hint,
  error,
  readOnly = false,
}: {
  photos: PhotoList;
  label: string;
  hint?: string;
  error?: string;
  readOnly?: boolean;
}) {
  const { t } = useT('seller');
  const input = useRef<HTMLInputElement>(null);
  const full = !photos.single && photos.items.length >= photos.limit;

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    photos.add(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  const notice = photos.notice === 'photoLimit' ? t('photoLimit', { count: photos.limit }) : photos.notice ? t(photos.notice) : null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.items.map((item, index) => (
          <li key={item.key} className="flex flex-col gap-1">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface">
              {item.preview ? (
                // Local previews (blob:) and short-lived signed links: next/image adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt={t('photoAlt', { number: index + 1 })} className="size-full object-cover" />
              ) : null}
              {index === 0 && !photos.single ? (
                <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                  {t('cover')}
                </span>
              ) : null}
              {item.state !== 'ready' ? <TileStatus state={item.state} onRetry={() => photos.retry(item.key)} /> : null}
            </div>
            {readOnly ? null : <div className="flex justify-between">
              {photos.single ? (
                <button type="button" onClick={() => input.current?.click()} className={tileButton}>
                  {t('changePhoto')}
                </button>
              ) : (
                <span className="flex">
                  <IconButton label={t('moveEarlier')} disabled={index === 0} onClick={() => photos.move(item.key, -1)} path="M15 6l-6 6 6 6" />
                  <IconButton
                    label={t('moveLater')}
                    disabled={index === photos.items.length - 1}
                    onClick={() => photos.move(item.key, 1)}
                    path="M9 6l6 6-6 6"
                  />
                </span>
              )}
              <IconButton label={t('removePhoto')} onClick={() => photos.remove(item.key)} path="M6 6l12 12M18 6L6 18" danger />
            </div>}
          </li>
        ))}

        {readOnly || full || (photos.single && photos.items.length > 0) ? null : (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-primary hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-8 fill-none stroke-current" strokeWidth={1.75}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {photos.single ? t('addPhoto') : t('addPhotos')}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple={!photos.single}
        onChange={onPick}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      {hint && !readOnly && !error && !notice ? <p className="text-sm text-text-muted">{hint}</p> : null}
      {notice ? <p className="text-sm text-warning">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const tileButton = 'min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary-soft';

function IconButton({
  label,
  path,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-11 items-center justify-center rounded-lg hover:bg-surface disabled:opacity-30',
        danger ? 'text-danger' : 'text-text-muted',
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
        <path d={path} />
      </svg>
    </button>
  );
}

function TileStatus({ state, onRetry }: { state: Exclude<PhotoState, 'ready'>; onRetry: () => void }) {
  const { t } = useT('seller');
  const busy = state === 'uploading' || state === 'processing';
  return (
    <div
      role={busy ? 'status' : 'alert'}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-xs font-semibold',
        busy ? 'bg-background/70 text-text' : 'bg-background/90 text-danger',
      )}
    >
      {busy ? <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> : null}
      {state === 'uploading' ? t('uploading') : state === 'processing' ? t('processing') : state === 'rejected' ? t('photoRejected') : t('uploadFailed')}
      {state === 'failed' ? (
        <button type="button" onClick={onRetry} className="min-h-9 rounded-md bg-primary px-3 text-on-primary">
          {t('common:retry')}
        </button>
      ) : null}
    </div>
  );
}
