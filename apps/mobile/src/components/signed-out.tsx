import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState } from '@/components/ui';
import type { IconName } from '@/components/icon';

/** Shown on tabs that need an account (Saved, Sell, Orders, Messages) while signed out. */
export function SignedOut({ icon }: { icon: IconName }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={icon}
      title={t('app.signInNeeded')}
      body={t('app.signInNeededBody')}
      action={<Button label={t('app.signIn')} onPress={() => router.push('/sign-in')} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
    />
  );
}
