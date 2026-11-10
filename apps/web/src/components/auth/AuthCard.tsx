'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import styles from './AuthCard.module.css';

export function AuthCard({ title, intro, children, footer, mode, next, progress }: { title: string; intro: string; children: ReactNode; footer: ReactNode; mode: 'signin' | 'signup'; next?: string; progress?: ReactNode }) {
  const { t } = useT('auth');
  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <aside className={styles.story} aria-label={t('ui.brandStory')}>
          <span className={styles.eyebrow}><span />{t('market:brandTagline')}</span>
          <h2>{t('ui.storyTitle')}<span>{t('ui.storyAccent')}</span></h2>
          <p>{t('ui.storyIntro')}</p>
          <div className={styles.storyPhoto}><Image src="/images/marketplace-shopper.jpg" alt="" fill sizes="(max-width: 800px) 1px, 500px" className={styles.shopper} /><span><Icon name="pin" />{t('ui.madeForNeighbours')}</span></div>
          <div className={styles.benefits}><div><span><Icon name="bag" /></span><p>{t('ui.benefitFinds')}</p></div><div><span><Icon name="message" /></span><p>{t('ui.benefitConnect')}</p></div></div>
          <span className={styles.storyLocation}><Icon name="pin" />{t('market:deltaNigeria')}</span>
        </aside>
        <section className={styles.panel} aria-labelledby="auth-title">
          <nav className={styles.modeSwitch} aria-label={t('ui.accountAccess')}><Link href={routes.signIn(next)} aria-current={mode === 'signin' ? 'page' : undefined}>{t('signIn')}</Link><Link href={routes.signUp(next)} aria-current={mode === 'signup' ? 'page' : undefined}>{t('signUp')}</Link></nav>
          <div className={styles.panelHeading}><span className={styles.headingIcon}><Icon name={mode === 'signup' ? 'user' : 'shop'} /></span><h1 id="auth-title">{title}</h1><p>{intro}</p></div>
          {progress}
          <div className={styles.formContent}>{children}</div>
          <div className={styles.footer}>{footer}</div>
          <div className={styles.privacy}><Icon name="shield" /><span>{t('phonePrivate')}</span></div>
        </section>
      </div>
    </div>
  );
}

export function AuthSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useT('auth');
  return <ol className={styles.steps} aria-label={t('ui.registrationSteps')}>{(['numberStep', 'verifyStep', 'detailsStep'] as const).map((key, index) => <li key={key} aria-current={current === index + 1 ? 'step' : undefined} data-complete={current > index + 1}><span>{current > index + 1 ? <Icon name="check" /> : index + 1}</span><strong>{t(`ui.${key}`)}</strong></li>)}</ol>;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={styles.error}>
      {message}
    </p>
  );
}
