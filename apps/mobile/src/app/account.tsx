import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, unwrap, useApi, type Me } from '@whyme/data';
import { errorKey, isSupportedLanguage } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, Chip, FieldLabel, FormError, IconButton, Input, Pill, ui } from '@/components/ui';
import { setLanguage } from '@/lib/i18n';
import { signOut, updateMe, useAccount } from '@/lib/session';
import { color, gutter, radius, space, type } from '@/theme';

/**
 * Your account (ACC03, ACC05): name, language (kept on the account), phone and email, password,
 * the terms and Privacy Policy, deleting the account (app store requirement), and signing out.
 */
export default function AccountScreen() {
  const { t } = useTranslation(['common', 'settings', 'auth', 'seller']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAccount();
  const [leaving, setLeaving] = useState(false);
  const working = useRef(false);

  async function leave() {
    if (working.current) return;
    working.current = true;
    setLeaving(true);
    await signOut(api, queryClient);
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
          <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
        </View>
        <Text style={type.display} accessibilityRole="header">{t('settings:account.title')}</Text>
        <Text style={[type.body, { color: color.muted }]}>{t('settings:account.intro')}</Text>

        {user ? (
          <>
            <Section title={t('settings:account.detailsTitle')} hint={t('settings:account.detailsHint')}>
              <Details user={user} />
              <Language user={user} />
            </Section>

            <Section title={t('settings:account.signInTitle')}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.small}>{t('settings:account.phone')}</Text>
                  <Text style={type.bodyStrong}>{user.phone}</Text>
                </View>
                <Pill label={t(user.phone_verified_at ? 'settings:account.confirmed' : 'settings:account.notConfirmed')} tone={user.phone_verified_at ? 'green' : 'gold'} />
              </View>
              <Text style={type.small}>{t('settings:account.phonePrivate')}</Text>
              {!user.phone_verified_at ? <Button label={t('app.account.confirmPhone')} tone="outline" onPress={() => router.push('/confirm-phone')} /> : null}
              <View style={ui.divider} />
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.small}>{t('settings:account.email')}</Text>
                  <Text style={type.bodyStrong}>{user.email ?? t('settings:account.noEmail')}</Text>
                </View>
                {user.email ? <Pill label={t(user.email_verified_at ? 'settings:account.confirmed' : 'settings:account.notConfirmed')} tone={user.email_verified_at ? 'green' : 'gold'} /> : null}
              </View>
            </Section>

            {user.capabilities?.some((c) => (c.capability === 'vendor' || c.capability === 'provider') && c.status === 'active') ? (
              <Pressable accessibilityRole="link" onPress={() => router.push('/payouts')} style={[ui.card, styles.section, styles.row]}>
                <Icon name="briefcase" size={24} tint={color.green} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.heading}>{t('seller:payouts.title')}</Text>
                  <Text style={type.small}>{t('app.account.payoutsHint')}</Text>
                </View>
                <Icon name="chevronRight" size={22} tint={color.green} />
              </Pressable>
            ) : null}

            <Section title={t('settings:account.passwordTitle')}>
              <Password />
            </Section>

            <Section title={t('settings:account.legalTitle')}>
              {(
                [
                  ['platform', t('common:termsPlatform')],
                  ['buyer', t('common:termsBuyer')],
                  ['seller', t('common:termsSeller')],
                  ['privacy', t('app.account.privacy')],
                ] as const
              ).map(([kind, label]) => (
                <Pressable key={kind} accessibilityRole="link" onPress={() => router.push({ pathname: '/terms/[type]', params: { type: kind } })} style={styles.link}>
                  <Text style={styles.linkText}>{label}</Text>
                  <Icon name="chevronRight" size={20} tint={color.green} />
                </Pressable>
              ))}
            </Section>

            <Section title={t('settings:account.deleteTitle')} hint={t('settings:account.deleteHint')} danger>
              <Button label={t('settings:account.deleteOpen')} tone="outline" onPress={() => router.push('/delete-account')} style={{ borderColor: color.danger }} />
            </Section>
          </>
        ) : null}

        <Button label={t('auth:signOut')} tone="quiet" busy={leaving} onPress={() => void leave()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, hint, danger, children }: { title: string; hint?: string; danger?: boolean; children: ReactNode }) {
  return (
    <View style={[ui.card, styles.section, danger && { borderColor: '#F0C8C3' }]}>
      <Text style={type.heading} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={type.small}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** First and last name, saved with the version on screen (a change elsewhere is shown, not overwritten). */
function Details({ user }: { user: Me }) {
  const { t } = useTranslation(['common', 'settings', 'auth', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changed = first.trim() !== user.first_name || last.trim() !== user.last_name;

  async function save() {
    if (busy || !changed) return;
    if (!first.trim() || !last.trim()) {
      setError(t('auth:nameRequired'));
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const fresh = unwrap(await api.PATCH('/v1/me', { body: { first_name: first.trim(), last_name: last.trim(), version: user.version } })).data;
      updateMe(queryClient, fresh);
      setNotice(t('settings:account.saved'));
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'conflict') {
        const current = (e.body as { data?: Me } | null)?.data;
        if (current) {
          updateMe(queryClient, current);
          setFirst(current.first_name);
          setLast(current.last_name);
        }
        setError(t('settings:account.changedElsewhere'));
      } else {
        setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <FormError message={error} />
      <FieldLabel>{t('settings:account.firstName')}</FieldLabel>
      <Input value={first} onChangeText={setFirst} accessibilityLabel={t('settings:account.firstName')} autoComplete="given-name" maxLength={60} />
      <FieldLabel>{t('settings:account.lastName')}</FieldLabel>
      <Input value={last} onChangeText={setLast} accessibilityLabel={t('settings:account.lastName')} autoComplete="family-name" maxLength={60} />
      <Button label={t('settings:account.save')} onPress={() => void save()} busy={busy} disabled={!changed} style={{ marginTop: space.sm }} />
      {notice ? <Text style={styles.ok} accessibilityRole="alert">{notice}</Text> : null}
    </View>
  );
}

/** The language changes the app at once and is kept on the account for the next phone or the website. */
function Language({ user }: { user: Me }) {
  const { t, i18n } = useTranslation(['settings']);
  const api = useApi();
  const queryClient = useQueryClient();

  async function choose(code: 'en' | 'ig') {
    if (!isSupportedLanguage(code)) return;
    await setLanguage(code);
    if (user.locale === code) return;
    try {
      updateMe(queryClient, unwrap(await api.PATCH('/v1/me', { body: { locale: code, version: user.version } })).data);
    } catch {
      // Kept on this phone either way; the account copy catches up next time.
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <FieldLabel>{t('settings:language')}</FieldLabel>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {(['en', 'ig'] as const).map((code) => (
          <Chip key={code} label={code === 'en' ? 'English' : 'Igbo'} selected={i18n.language === code} onPress={() => void choose(code)} />
        ))}
      </View>
    </View>
  );
}

/** Change the password with the current one; other phones and browsers are signed out. */
function Password() {
  const { t } = useTranslation(['common', 'settings', 'errors']);
  const api = useApi();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change() {
    if (busy) return;
    if (!current || next.length < 8) {
      setError(next.length < 8 ? t('settings:account.newPasswordHint') : t('errors:validation_failed'));
      return;
    }
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const { error: failure, response } = await api.POST('/v1/me/password', { body: { current_password: current, password: next } });
      if (!response.ok) throw new ApiRequestError(response.status, (failure as never) ?? null);
      setCurrent('');
      setNext('');
      setNotice(t('app.account.signedOutElsewhere'));
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <FormError message={error} />
      <FieldLabel>{t('settings:account.currentPassword')}</FieldLabel>
      <Input value={current} onChangeText={setCurrent} secureTextEntry accessibilityLabel={t('settings:account.currentPassword')} autoComplete="current-password" textContentType="password" />
      <FieldLabel>{t('settings:account.newPassword')}</FieldLabel>
      <Input value={next} onChangeText={setNext} secureTextEntry accessibilityLabel={t('settings:account.newPassword')} autoComplete="new-password" textContentType="newPassword" />
      <Text style={type.small}>{t('settings:account.newPasswordHint')}</Text>
      <Button label={busy ? t('settings:account.changingPassword') : t('settings:account.changePassword')} onPress={() => void change()} busy={busy} style={{ marginTop: space.sm }} />
      {notice ? <Text style={styles.ok} accessibilityRole="alert">{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  section: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md },
  linkText: { fontSize: 16, fontWeight: '600', color: color.green },
  ok: { color: color.green, fontWeight: '700' },
});
