import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/app-header';
import { Icon } from '@/components/icon';
import { ListingForm, type Kind } from '@/components/listing-form';
import { SignedOut } from '@/components/signed-out';
import { Button, EmptyState } from '@/components/ui';
import { useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/** Sell: the approved Create listing screen. Photos, details, how buyers get it, then review and publish. */
export default function SellScreen() {
  const { t } = useTranslation(['common', 'seller']);
  const { status, user } = useAccount();
  const [kind, setKind] = useState<Kind>('product');
  const capability = kind === 'product' ? 'vendor' : 'provider';
  const canSell = Boolean(user?.capabilities?.some((c) => c.capability === capability && c.status === 'active'));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {status !== 'signed_in' || !user ? (
          <View style={styles.content}>
            <Text style={type.display}>{t('app.sell.title')}</Text>
            <SignedOut icon="plus" />
          </View>
        ) : !user.phone_verified_at ? (
          <View style={styles.content}>
            <Text style={type.display}>{t('app.sell.title')}</Text>
            <EmptyState
              icon="shield"
              title={t('app.sell.phoneNeeded')}
              action={<Button label={t('app.account.confirmPhone')} onPress={() => router.push('/confirm-phone')} style={{ alignSelf: 'stretch', marginTop: space.sm }} />}
            />
          </View>
        ) : (
          <>
            <Pressable accessibilityRole="link" onPress={() => router.push('/my-listings')} style={styles.mine}>
              <Icon name="bag" size={20} tint={color.green} />
              <Text style={styles.mineText}>{t('seller:navListings')}</Text>
              <Icon name="chevronRight" size={18} tint={color.green} />
            </Pressable>
            <ListingForm kind={kind} onKind={setKind} canSell={canSell} />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-end', paddingHorizontal: gutter, minHeight: 36 },
  mineText: { fontSize: 15, fontWeight: '600', color: color.green },
});
