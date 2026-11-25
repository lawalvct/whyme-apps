import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ApiRequestError, unwrap, useApi } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { normaliseNigerianPhone } from '@whyme/schemas';
import { Button, FieldLabel, FormError, IconButton, Input } from '@/components/ui';
import { color, gutter, space, type } from '@/theme';

/**
 * Forgot password (ACC-05): phone number → a 6-digit code by SMS → the code and a new password.
 * The server limits how often codes are sent and tried; the app shows its messages. Afterwards
 * the person signs in with the new password (every other session was signed out).
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const api = useApi();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState<'send' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const working = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function message(e: unknown): string {
    const field = e instanceof ApiRequestError ? Object.values(e.body?.fields ?? {})[0]?.[0] : undefined;
    return field ?? t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error'));
  }

  async function send() {
    const e164 = normaliseNigerianPhone(phone);
    if (!e164) {
      setError(t('errors:phone_invalid'));
      return;
    }
    if (working.current || wait > 0) return;
    working.current = true;
    setBusy('send');
    setError(null);
    try {
      const sent = unwrap(await api.POST('/v1/auth/otp', { body: { phone: e164, purpose: 'reset_password' } as never })).data as { sent_to?: string; resend_in?: number | string };
      setSentTo(sent.sent_to ?? e164);
      setWait(Number(sent.resend_in) || 60);
    } catch (e) {
      setError(message(e));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  async function reset() {
    const e164 = normaliseNigerianPhone(phone);
    if (!e164) return;
    if (!/^\d{6}$/.test(code)) {
      setError(t('errors:otp_invalid'));
      return;
    }
    if (password.length < 8) {
      setError(t('errors:validation_failed'));
      return;
    }
    if (working.current) return;
    working.current = true;
    setBusy('reset');
    setError(null);
    try {
      unwrap(await api.POST('/v1/auth/password/reset', { body: { phone: e164, code, password } as never }));
      setDone(true);
    } catch (e) {
      setError(message(e));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
            <IconButton icon="chevronLeft" label={t('common:back')} onPress={back} size={44} bordered={false} />
          </View>
          <Text style={type.display} accessibilityRole="header">{t('resetPassword')}</Text>
          {done ? (
            <>
              <Text style={[type.bodyStrong, { color: color.green }]} accessibilityRole="alert">{t('common:app.reset.done')}</Text>
              <Button label={t('common:app.reset.signIn')} onPress={() => router.replace('/sign-in')} />
            </>
          ) : (
            <>
              <Text style={[type.body, { color: color.muted }]}>{t('common:app.reset.intro')}</Text>
              <FormError message={error} />
              <FieldLabel>{t('phone')}</FieldLabel>
              <Input value={phone} onChangeText={setPhone} accessibilityLabel={t('phone')} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" editable={!sentTo} />
              {sentTo ? (
                <>
                  <Text style={type.small}>{t('common:app.reset.codeSent', { phone: sentTo })}</Text>
                  <FieldLabel>{t('code')}</FieldLabel>
                  <Input value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} accessibilityLabel={t('code')} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
                  <FieldLabel>{t('newPassword')}</FieldLabel>
                  <Input value={password} onChangeText={setPassword} accessibilityLabel={t('newPassword')} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
                  <Text style={type.small}>{t('settings:account.newPasswordHint')}</Text>
                  <Button label={t('resetPassword')} busy={busy === 'reset'} disabled={busy !== null} onPress={() => void reset()} />
                  <Button label={wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')} tone="quiet" busy={busy === 'send'} disabled={busy !== null || wait > 0} onPress={() => void send()} />
                </>
              ) : (
                <Button label={t('sendCode')} busy={busy === 'send'} onPress={() => void send()} />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
});
