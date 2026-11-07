'use client';

import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { useT } from '@/lib/i18n';
import { Photo } from './Photo';

type GalleryPhoto = { id: string; urls: { large: string; medium: string; thumb: string } };

/** Main photo plus thumbnails. Uses the 800px copy to keep data use low (NFR01). */
export function PhotoGallery({ photos, alt }: { photos: GalleryPhoto[]; alt: string }) {
  const { t } = useT('market');
  const [index, setIndex] = useState(0);
  const current = photos[index];

  return (
    <div className="flex flex-col gap-2">
      <Photo src={current?.urls.medium} alt={alt} priority className="aspect-[4/3] w-full rounded-xl" />
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label={t('photoCount', { count: photos.length })}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              aria-label={`${i + 1} / ${photos.length}`}
              className={cn('shrink-0 rounded-lg border-2', i === index ? 'border-primary' : 'border-transparent')}
            >
              <Photo src={photo.urls.thumb} alt="" className="size-16 rounded-md" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
