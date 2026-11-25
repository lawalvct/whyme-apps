import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, unwrap, useApi } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, EmptyState, FieldLabel, FormError, IconButton, Input, ListLoading, ui } from '@/components/ui';
import { forgetSession } from '@/lib/session';
import { color, gutter, radius, space, type } from '@/theme';

const REMOVED = ['details', 'listings', 'jobs', 'bank'] as const;
const KEPT = ['money', 'chats', 'records'] as const;
const LINKS: Record<string, '/orders' | '/messages'> = { orders_open: '/orders', disputes_open: '/orders', requests_open: '/messages', payouts_open: '/orders' };

/**
 * Deleting the account inside the app (App Store and Google Play require it; ACC05, NFR05). Same
 * rules as the website: says what goes and what stays, refuses while money or work is open, then
 * needs the password and a tick. Afterwards this phone forgets the account.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const check = useQuery({ queryKey: ['me', 'deletion'], queryFn: async () => unwrap(await api.GET('/v1/me/deletion')).data });
  const [password, setPassword] = useState('');
  const [understand, setUnderstand] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const working = useRef(false);
  const blockers = Object.entries((check.data?.blockers ?? {}) as Record<string, number>).filter(([, n]) => n > 0);

  async function remove() {
    if (working.current) return;
    if (!password) {
      setError(t('errors:validation_failed'));
      return;
    }
    if (!understand) {
      setError(t('settings:deletion.understandRequired'));
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: failure, response } = await api.POST('/v1/me/deletion', { body: { password } });
      if (!response.ok) throw new ApiRequestError(response.status, (failure as never) ?? null);
      await forgetSession(queryClient);
      setDone(true);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'account_deletion_blocked') void check.refetch();
      const field = e instanceof ApiRequestError ? Object.values(e.body?.fields ?? {})[0]?.[0] : undefined;
      setError(field ?? t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      working.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <EmptyState icon="checkCircle" title={t('common:app.account.deletedTitle')} body={t('common:app.account.deletedBody')} action={<Button label={t('settings:deletion.doneHome')} onPress={() => router.replace('/')} style={{ alignSelf: 'stretch', marginTop: space.sm }} />} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
          <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} size={44} bordered={false} />
        </View>
        <Text style={type.display} accessibilityRole="header">{t('settings:deletion.title')}</Text>
        <Text style={[type.body, { color: color.muted }]}>{t('settings:deletion.intro')}</Text>

        <View style={[ui.card, styles.box]}>
          <Text style={type.heading}>{t('settings:deletion.removedTitle')}</Text>
          {REMOVED.map((key) => (
            <Text key={key} style={type.body}>• {t(`settings:deletion.removed.${key}`)}</Text>
          ))}
          <Text style={[type.heading, { marginTop: space.sm }]}>{t('settings:deletion.keptTitle')}</Text>
          {KEPT.map((key) => (
            <Text key={key} style={type.body}>• {t(`settings:deletion.kept.${key}`)}</Text>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/terms/[type]', params: { type: 'privacy' } })}>
            <Text style={styles.link}>{t('settings:deletion.keptMore')}</Text>
          </Pressable>
        </View>

        {check.isPending ? (
          <ListLoading />
        ) : check.isError ? (
          <FormError message={t(errorKey(check.error instanceof ApiRequestError ? check.error.code : 'network_error'))} />
        ) : blockers.length > 0 ? (
          <View style={[styles.box, styles.blocked]} accessibilityRole="alert">
            <Text style={type.heading}>{t('settings:deletion.blockedTitle')}</Text>
            <Text style={type.small}>{t('settings:deletion.blockedIntro')}</Text>
            {blockers.map(([code, count]) => (
              <Pressable key={code} accessibilityRole="link" onPress={() => router.push(LINKS[code] ?? '/orders')} style={styles.blocker}>
                <Text style={[type.body, { flex: 1 }]}>{t(`settings:deletion.blockers.${code}`, { count })}</Text>
                <Icon name="chevronRight" size={20} tint={color.green} />
              </Pressable>
            ))}
            <Text style={type.small}>{t('settings:deletion.stuck')}</Text>
          </View>
        ) : (
          <View style={[ui.card, styles.box, { borderColor: '#F0C8C3' }]}>
            <FormError message={error} />
            <FieldLabel>{t('settings:deletion.password')}</FieldLabel>
            <Input value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel={t('settings:deletion.password')} autoComplete="current-password" textContentType="password" />
            <Text style={type.small}>{t('settings:deletion.passwordHint')}</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: understand }} onPress={() => setUnderstand((v) => !v)} style={styles.tick}>
              {understand ? <Icon name="checkCircle" size={24} tint={color.danger} /> : <View style={styles.tickOff} />}
              <Text style={[type.body, { flex: 1 }]}>{t('settings:deletion.understand')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings:deletion.confirm')}
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => void remove()}
              style={({ pressed }) => [styles.danger, (pressed || busy) && { opacity: 0.8 }]}>
              <Text style={styles.dangerText}>{busy ? t('settings:deletion.deleting') : t('settings:deletion.confirm')}</Text>
            </Pressable>
            <Button label={t('settings:deletion.cancel')} tone="quiet" disabled={busy} onPress={() => router.back()} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  box: { padding: space.lg, gap: space.sm },
  blocked: { borderRadius: radius.lg, backgroundColor: color.goldSoft, borderWidth: 1, borderColor: '#F3D9A6' },
  blocker: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  link: { fontSize: 15, fontWeight: '600', color: color.green, marginTop: space.sm },
  tick: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 48, paddingTop: space.sm },
  tickOff: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color.faint },
  danger: { minHeight: 52, borderRadius: radius.md, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  dangerText: { color: color.white, fontSize: 18, fontWeight: '700' },
});
