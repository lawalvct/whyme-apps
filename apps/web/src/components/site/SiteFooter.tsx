'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  const { t } = useT('market');
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.brand}>
            <Link href={routes.home} aria-label="WHY ME"><Image src="/brand/whyme-logo-full.png" alt="WHY ME" width={158} height={37} /></Link>
            <span className={styles.tagline}>{t('brandTagline')}</span>
            <p>{t('footerBrandDescription')}</p>
            <span className={styles.location}><Icon name="pin" />{t('deltaNigeria')}</span>
          </div>

          <nav className={styles.linkColumn} aria-labelledby="footer-explore-title">
            <h2 id="footer-explore-title">{t('footerExplore')}</h2>
            <ul>
              <li><Link href={routes.search({ kind: 'product' })}>{t('shopProducts')}</Link></li>
              <li><Link href={routes.search({ kind: 'service' })}>{t('footerBrowseServices')}</Link></li>
              <li><Link href={routes.jobs()}>{t('jobs')}</Link></li>
              <li><Link href={routes.search({ type: 'people', kind: 'business' })}>{t('footerLocalBusinesses')}</Link></li>
              <li><Link href={routes.search({ type: 'people', kind: 'provider' })}>{t('footerFindExperts')}</Link></li>
            </ul>
          </nav>

          <nav className={styles.linkColumn} aria-labelledby="footer-account-title">
            <h2 id="footer-account-title">{t('footerYourMarketplace')}</h2>
            <ul>
              <li><Link href={routes.sell}>{t('startSelling')}</Link></li>
              <li><Link href={routes.signUp(routes.sell)}>{t('footerCreateAccount')}</Link></li>
              <li><Link href={routes.orders()}>{t('footerOrders')}</Link></li>
              <li><Link href={routes.messages}>{t('footerMessages')}</Link></li>
            </ul>
          </nav>

          <div className={styles.community}>
            <h2>{t('footerStayConnected')}</h2>
            <p>{t('footerSocialDescription')}</p>
            <div className={styles.socialLinks}>
              <a href="https://www.facebook.com/whyme" target="_blank" rel="noopener noreferrer" aria-label="WHY ME on Facebook"><Icon name="facebook" /><span>Facebook</span><Icon name="arrow" /></a>
              <a href="https://x.com/whyme" target="_blank" rel="noopener noreferrer" aria-label="WHY ME on X"><Icon name="x" /><span>@whyme</span><Icon name="arrow" /></a>
            </div>
          </div>
        </div>

        <section id="marketplace-safety" className={styles.safety} aria-labelledby="footer-safety-title">
          <span className={styles.safetyIcon}><Icon name="shield" /></span>
          <div className={styles.safetyCopy}><h2 id="footer-safety-title">{t('footerSafetyHeading')}</h2><p>{t('safetyBody')}</p></div>
          <span className={styles.safetyNote}><Icon name="check" />{t('footerSafetyNote')}</span>
        </section>

        <div className={styles.bottom}>
          <p>{t('footerCopyright')}</p>
          <nav aria-label={t('common:termsOtherTitle')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href={routes.terms('platform')}>{t('common:termsPlatform')}</Link>
            <Link href={routes.terms('buyer')}>{t('common:termsBuyer')}</Link>
            <Link href={routes.terms('seller')}>{t('common:termsSeller')}</Link>
            <Link href={routes.privacy}>{t('common:privacyPolicy')}</Link>
          </nav>
          <span className={styles.madeForDelta}><Icon name="heart" />{t('madeForDelta')}</span>
          <button type="button" className={styles.backToTop} onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>{t('footerBackToTop')}<span><Icon name="arrow" /></span></button>
        </div>
      </div>
    </footer>
  );
}
