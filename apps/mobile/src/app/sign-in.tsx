import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, useApi } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { normaliseNigerianPhone } from '@whyme/schemas';
import { Image } from 'expo-image';
import { Button, FieldLabel, FormError, IconButton, Input } from '@/components/ui';
import { signIn } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/** Sign in with phone and password; a new phone may be asked for a code first. Sign-up stays on the website for now. */
export default function SignInScreen() {
  const { t } = useTranslation(['common', 'auth']);
  const api = useApi();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState<{ channel: string; sentTo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  async function submit() {
    if (working.current) return;
    // The same +234 form the website sends.
    const e164 = normaliseNigerianPhone(phone);
    if (!e164 || !password) {
      setError(t(e164 ? 'errors:validation_failed' : 'errors:phone_invalid'));
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(api, queryClient, { phone: e164, password, code: needsCode ? code.trim() : null });
      if (result.done) {
        if (router.canGoBack()) router.back();
        else router.replace('/');
        return;
      }
      setNeedsCode({ channel: result.channel, sentTo: result.sentTo });
    } catch (e) {
      // Show the server's own words for a field (for example a wrong code) when it gives them.
      const field = e instanceof ApiRequestError ? Object.values(e.body?.fields ?? {})[0]?.[0] : undefined;
      setError(field ?? t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Image source={require('@/assets/images/brand/whyme-logo-full.png')} style={{ width: 146, height: 35 }} contentFit="contain" accessibilityLabel="WHY ME" />
            <IconButton icon="close" label={t('common:close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
          </View>
          <Text style={type.display} accessibilityRole="header">{t('app.signInTitle')}</Text>
          <Text style={[type.body, { color: color.muted }]}>{t('app.signInIntro')}</Text>
          <FormError message={error} />

          <FieldLabel>{t('auth:phone')}</FieldLabel>
          <Input value={phone} onChangeText={setPhone} accessibilityLabel={t('auth:phone')} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
          <FieldLabel>{t('auth:password')}</FieldLabel>
          <Input value={password} onChangeText={setPassword} accessibilityLabel={t('auth:password')} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => void submit()} />
          {needsCode ? (
            <>
              <FieldLabel>{t('auth:code')}</FieldLabel>
              <Text style={type.small}>{needsCode.channel === 'email' ? t('auth:newDeviceCodeEmail', { email: needsCode.sentTo }) : t('auth:newDeviceCode')}</Text>
              <Input value={code} accessibilityLabel={t('auth:code')} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} autoFocus />
            </>
          ) : null}

          <Button label={busy ? t('common:loading') : t('auth:signIn')} busy={busy} onPress={() => void submit()} style={{ marginTop: space.md }} />
          <Text style={[type.small, { textAlign: 'center' }]}>{t('app.createAccount')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
});
