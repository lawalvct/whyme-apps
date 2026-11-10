'use client';

import { useRef, useState } from 'react';
import type { PublicListing } from '@whyme/data';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { useT } from '@/lib/i18n';
import { Photo } from './Photo';
import styles from './ListingGallery.module.css';

export function ListingGallery({ photos, title }: { photos: PublicListing['photos']; title: string }) {
  const { t } = useT('market');
  const [selected, setIndex] = useState(0);
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  const dialog = useRef<HTMLDialogElement>(null);
  const current = photos[index];
  const move = (step: number) => setIndex((value) => (Math.min(value, photos.length - 1) + step + photos.length) % photos.length);
  const photoLabel = t('listingImageAlt', { title, number: index + 1 });

  return (
    <section className={styles.gallery} aria-label={t('listingPhotos')}>
      <div className={styles.stage}>
        {current ? <button type="button" className={styles.openPhoto} onClick={() => dialog.current?.showModal()} aria-label={t('listingEnlargePhoto', { number: index + 1 })}><Photo src={current.urls.medium} alt={photoLabel} priority className={styles.mainPhoto} /><span className={styles.zoomHint}><Icon name="zoom" />{t('listingEnlarge')}</span></button> : <div className={styles.noPhoto}><Icon name="image" /><span>{t('noPhoto')}</span></div>}
        {photos.length > 1 && <><button type="button" className={`${styles.arrow} ${styles.previous}`} aria-label={t('listingPreviousPhoto')} onClick={() => move(-1)}><Icon name="arrow" /></button><button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={t('listingNextPhoto')} onClick={() => move(1)}><Icon name="arrow" /></button></>}
        {photos.length > 0 && <span className={styles.counter} aria-live="polite"><Icon name="image" />{index + 1}<span>/ {photos.length}</span></span>}
      </div>
      {photos.length > 1 && <div className={styles.thumbnailRow}><div className={styles.thumbnails} role="group" aria-label={t('photoCount', { count: photos.length })}>{photos.map((photo, photoIndex) => <button key={photo.id} type="button" aria-pressed={index === photoIndex} aria-label={t('listingShowPhoto', { number: photoIndex + 1 })} onClick={() => setIndex(photoIndex)}><Photo src={photo.urls.thumb} alt="" className={styles.thumbnail} /></button>)}</div><span className={styles.photoHint}>{t('listingPhotoHint')}</span></div>}

      <dialog ref={dialog} className={styles.dialog} aria-label={t('listingPhotosOf', { title })} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={(event) => { if (photos.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>
        <div className={styles.dialogContent}>
          <div className={styles.dialogHeader}><div><h2>{title}</h2><span aria-live="polite">{t('slidePosition', { current: index + 1, total: photos.length })}</span></div><button type="button" aria-label={t('listingCloseGallery')} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
          <div className={styles.lightboxStage}>{current && <Photo src={current.urls.large} alt={photoLabel} className={styles.largePhoto} />}{photos.length > 1 && <><button type="button" className={`${styles.arrow} ${styles.previous}`} aria-label={t('listingPreviousPhoto')} onClick={() => move(-1)}><Icon name="arrow" /></button><button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={t('listingNextPhoto')} onClick={() => move(1)}><Icon name="arrow" /></button></>}</div>
        </div>
      </dialog>
    </section>
  );
}
