import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, unwrap, useApi } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Button, FieldLabel, FormError, IconButton, Input } from '@/components/ui';
import { updateMe, useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/**
 * Confirm the phone number by SMS (accounts that signed up with an email code). Buying, selling
 * and messaging need it (AT01). Resending waits for the server's cooldown.
 */
export default function ConfirmPhoneScreen() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAccount();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const working = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send() {
    if (working.current || wait > 0) return;
    working.current = true;
    setBusy('send');
    setError(null);
    try {
      const sent = unwrap(await api.POST('/v1/me/phone/code')).data;
      setSentTo(sent.sent_to);
      setWait(Number(sent.resend_in) || 60);
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  async function verify() {
    if (working.current) return;
    if (!/^\d{6}$/.test(code)) {
      setError(t('errors:otp_invalid'));
      return;
    }
    working.current = true;
    setBusy('verify');
    setError(null);
    try {
      updateMe(queryClient, unwrap(await api.POST('/v1/me/phone/verify', { body: { code } })).data);
      setDone(true);
    } catch (e) {
      const field = e instanceof ApiRequestError ? Object.values(e.body?.fields ?? {})[0]?.[0] : undefined;
      setError(field ?? t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  const verified = done || Boolean(user?.phone_verified_at);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
          <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
        </View>
        <Text style={type.display} accessibilityRole="header">{t('auth:confirmPhoneTitle')}</Text>
        {verified ? (
          <>
            <Text style={[type.bodyStrong, { color: color.green }]} accessibilityRole="alert">{t('common:app.account.phoneDone')}</Text>
            <Button label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </>
        ) : (
          <>
            <Text style={[type.body, { color: color.muted }]}>{t('auth:confirmPhoneBuy')}</Text>
            <Text style={type.body}>{t('auth:confirmPhoneSendTo', { phone: user?.phone ?? '' })}</Text>
            <FormError message={error} />
            {sentTo ? (
              <>
                <Text style={type.small}>{t('common:app.account.codeSent', { phone: sentTo })}</Text>
                <FieldLabel>{t('auth:code')}</FieldLabel>
                <Input
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  accessibilityLabel={t('auth:code')}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  onSubmitEditing={() => void verify()}
                />
                <Button label={t('common:app.account.confirm')} busy={busy === 'verify'} disabled={busy !== null} onPress={() => void verify()} />
                <Button label={wait > 0 ? t('auth:resendIn', { seconds: wait }) : t('auth:resend')} tone="quiet" busy={busy === 'send'} disabled={busy !== null || wait > 0} onPress={() => void send()} />
              </>
            ) : (
              <Button label={t('auth:sendCode')} busy={busy === 'send'} onPress={() => void send()} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
});
