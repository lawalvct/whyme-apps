'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MarketplaceIcon as Icon, type MarketplaceIconName } from '@/components/ui/MarketplaceIcon';
import { useRotatingContent } from '@/components/ui/useRotatingContent';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import styles from './HomeHero.module.css';

const benefits: { icon: MarketplaceIconName; title: string; body: string }[] = [
  { icon: 'shop', title: 'localBenefitTitle', body: 'localBenefitBody' },
  { icon: 'tools', title: 'serviceBenefitTitle', body: 'serviceBenefitBody' },
  { icon: 'shield', title: 'safeBenefitTitle', body: 'safeBenefitBody' },
];

const slides = [
  { id: 'local', badge: 'heroBadge', title: 'heroHeadingLine1', accent: 'heroHeadingLine2', description: 'heroDescription', action: 'exploreMarketplace', href: routes.search(), note: 'communityNote', subnote: 'communitySubnote', sticker: 'findItLoveIt', cardLabel: 'closerThanYouThink', cardTitle: 'goodThingsNearYou', caption: 'localConnections' },
  { id: 'igbo', badge: 'igboHeroBadge', title: 'igboHeroTitle', accent: 'igboHeroAccent', description: 'igboHeroDescription', action: 'exploreIgboMarket', href: routes.search({ type: 'people', kind: 'business' }), note: 'igboCommunityNote', subnote: 'igboCommunitySubnote', sticker: 'igboSticker', cardLabel: 'igboCardLabel', cardTitle: 'igboCardTitle', caption: 'igboCaption' },
  { id: 'christmas', badge: 'christmasHeroBadge', title: 'christmasHeroTitle', accent: 'christmasHeroAccent', description: 'christmasHeroDescription', action: 'exploreChristmas', href: routes.search({ q: 'Christmas' }), note: 'christmasCommunityNote', subnote: 'christmasCommunitySubnote', sticker: 'christmasSticker', cardLabel: 'christmasCardLabel', cardTitle: 'christmasCardTitle', caption: 'christmasCaption' },
] as const;

const slidePhotos = {
  local: { src: '/images/marketplace-shopper.jpg', alt: 'shopperPhotoAlt' },
  igbo: { src: '/images/igbo-market-man.png', alt: 'igboMarketPhotoAlt' },
  christmas: { src: '/images/christmas-santa-gifts.png', alt: 'christmasSantaPhotoAlt' },
} as const;

export function HomeHero() {
  const { t } = useT('market');
  const rotation = useRotatingContent(slides.length, 8000);
  const slide = slides[rotation.index];
  const photo = slidePhotos[slide.id];

  return (
    <section className={styles.section} aria-label={t('marketplaceHighlights')} aria-roledescription="carousel">
      <div className={styles.hero} data-theme={slide.id}
        onMouseEnter={() => rotation.setInteracting(true)} onMouseLeave={() => rotation.setInteracting(false)}
        onFocusCapture={() => rotation.setInteracting(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) rotation.setInteracting(false); }}>
        <div className={styles.heroTexture} aria-hidden="true" />
        <div key={slide.id} className={styles.slide} role="group" aria-roledescription="slide" aria-label={t('slidePosition', { current: rotation.index + 1, total: slides.length })} aria-live={rotation.paused ? 'polite' : 'off'}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}><Icon name={slide.id === 'christmas' ? 'gift' : 'pin'} />{t(slide.badge)}</span>
            <h1>{t(slide.title)}<br /><span>{t(slide.accent)}</span></h1>
            <p className={styles.description}>{t(slide.description)}</p>
            <div className={styles.actions}>
              <Link href={slide.href} className={styles.explore}>{t(slide.action)}<Icon name="arrow" /></Link>
              <Link href={routes.sell} className={styles.startSelling}>{t('startSelling')}<Icon name="arrow" /></Link>
            </div>
            <div className={styles.communityNote}>
              <span className={styles.communityMark}><Image src="/brand/whyme-mark-white.png" alt="" width={24} height={24} /></span>
              <p>{t(slide.note)}<span>{t(slide.subnote)}</span></p>
            </div>
          </div>

          <div className={styles.visual}>
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.photo}>
              <Image src={photo.src} alt={t(photo.alt)} fill sizes="(max-width: 640px) 250px, (max-width: 950px) 280px, 360px" preload />
            </div>
            <span className={styles.sparkleTop} aria-hidden="true"><Icon name="sparkle" /></span>
            <span className={styles.sparkleBottom} aria-hidden="true"><Icon name="sparkle" /></span>
            <div className={styles.loveNote}><span><Icon name={slide.id === 'christmas' ? 'gift' : 'heart'} /></span>{t(slide.sticker)}</div>
            <div className={styles.localCard}>
              <span><Icon name="pin" /></span>
              <p>{t(slide.cardLabel)}<strong>{t(slide.cardTitle)}</strong></p>
              <span className={styles.localCardCheck}><Icon name="shield" /></span>
            </div>
            <span className={styles.visualCaption}>{t(slide.caption)}</span>
          </div>
        </div>

        <div className={styles.sliderControls}>
          <span className={styles.slideCount} aria-hidden="true">{String(rotation.index + 1).padStart(2, '0')}<span> / {String(slides.length).padStart(2, '0')}</span></span>
          <div className={styles.slideDots}>
            {slides.map((item, index) => <button key={item.id} type="button" onClick={() => rotation.select(index)} aria-label={t('goToSlide', { number: index + 1 })} aria-pressed={rotation.index === index}><span /></button>)}
          </div>
          <div className={styles.slideArrows}>
            <button type="button" onClick={rotation.togglePaused} aria-label={t(rotation.paused ? 'playSlideshow' : 'pauseSlideshow')}><Icon name={rotation.paused ? 'play' : 'pause'} /></button>
            <button type="button" onClick={() => rotation.select(rotation.index - 1)} aria-label={t('previousSlide')}><Icon name="arrow" /></button>
            <button type="button" onClick={() => rotation.select(rotation.index + 1)} aria-label={t('nextSlide')}><Icon name="arrow" /></button>
          </div>
        </div>
      </div>

      <div className={styles.benefits}>
        {benefits.map(({ icon, title, body }) => (
          <div key={title} className={styles.benefit}>
            <span className={styles.benefitIcon}><Icon name={icon} /></span>
            <div><h2>{t(title)}</h2><p>{t(body)}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
