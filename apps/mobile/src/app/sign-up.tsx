import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, queryKeys, unwrap, useApi, useConfig } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { normaliseNigerianPhone, otpSchema, passwordSchema, personNameSchema } from '@whyme/schemas';
import { Icon } from '@/components/icon';
import { Button, FieldLabel, FormError, IconButton, Input } from '@/components/ui';
import { registerAccount } from '@/lib/session';
import { color, gutter, radius, space, type } from '@/theme';

type Destination = { phone: string; email: string | null };
type Step = 'phone' | 'code' | 'details';
const EMAIL_FLAG = 'signup_email_otp_enabled';

/** Native registration: number, code, then account details. */
export default function SignUpScreen() {
  const { t } = useTranslation(['auth', 'common', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const config = useConfig();
  const emailAllowed = config.data?.features[EMAIL_FLAG] === true;
  const lock = useRef(false);
  const [step, setStep] = useState<Step>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [byEmail, setByEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<Destination | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  function message(cause: unknown): string {
    const field = cause instanceof ApiRequestError ? Object.values(cause.body?.fields ?? {})[0]?.[0] : undefined;
    return field ?? t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error'));
  }

  async function requestCode(destination: Destination): Promise<number> {
    const response = unwrap(await api.POST('/v1/auth/otp', {
      body: destination.email
        ? { phone: destination.phone, purpose: 'register', channel: 'email', email: destination.email }
        : { phone: destination.phone, purpose: 'register' },
    }));
    return Number(response.data.resend_in) || 60;
  }

  async function sendCode() {
    if (lock.current) return;
    const normalised = normaliseNigerianPhone(phone);
    if (!normalised) return setError(t('errors:phone_invalid'));
    const selectedEmail = byEmail && emailAllowed ? email.trim().toLowerCase() : null;
    if (byEmail && emailAllowed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedEmail ?? '')) return setError(t('auth:emailInvalid'));
    const destination = { phone: normalised, email: selectedEmail };
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      setWait(await requestCode(destination));
      setSent(destination);
      setCode('');
      setStep('code');
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === 'email_otp_disabled') {
        setByEmail(false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.config });
      }
      setError(message(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function resendCode() {
    if (lock.current || !sent || wait > 0) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      setWait(await requestCode(sent));
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === 'email_otp_disabled') {
        setSent(null);
        setByEmail(false);
        setStep('phone');
        void queryClient.invalidateQueries({ queryKey: queryKeys.config });
      }
      setError(message(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (lock.current || !sent) return;
    if (!otpSchema.safeParse(code).success) return setError(t('errors:otp_invalid'));
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = unwrap(await api.POST('/v1/auth/otp/verify', { body: { phone: sent.phone, purpose: 'register', code } }));
      setRegistrationToken(response.data.registration_token);
      setStep('details');
    } catch (cause) {
      setError(message(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function finish() {
    if (lock.current || !sent || !registrationToken) return;
    if (!personNameSchema.safeParse(firstName).success || !personNameSchema.safeParse(lastName).success) return setError(t('auth:nameRequired'));
    if (!passwordSchema.safeParse(password).success) return setError(t('auth:passwordHint'));
    if (!accepted) return setError(t('auth:termsRequired'));
    lock.current = true;
    setBusy(true);
    setError(null);
    let completed = false;
    try {
      await registerAccount(api, queryClient, {
        phone: sent.phone, registrationToken, firstName: firstName.trim(), lastName: lastName.trim(), password,
      });
      completed = true;
      router.dismissTo('/');
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === 'registration_expired') {
        setRegistrationToken(null);
        setSent(null);
        setCode('');
        setStep('phone');
      }
      setError(message(cause));
    } finally {
      if (!completed) {
        lock.current = false;
        setBusy(false);
      }
    }
  }

  const number = step === 'phone' ? 1 : step === 'code' ? 2 : 3;
  const titles = { phone: 'ui.signUpTitle', code: 'ui.verifyTitle', details: 'ui.detailsTitle' } as const;
  const intros = { phone: 'ui.signUpIntro', code: 'ui.verifyIntro', details: 'ui.detailsIntro' } as const;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Image source={require('@/assets/images/brand/whyme-logo-full.png')} style={styles.logo} contentFit="contain" accessibilityLabel="WHY ME" />
            <IconButton icon="close" label={t('common:close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
          </View>

          <View style={styles.progress} accessibilityLabel={t('auth:ui.registrationSteps')}>
            {(['phone', 'code', 'details'] as const).map((item, index) => (
              <View key={item} style={styles.progressItem}>
                <View style={[styles.progressBar, index < number && styles.progressBarActive]} />
                <Text style={[styles.progressLabel, index < number && styles.progressLabelActive]}>{t(`auth:ui.${item === 'phone' ? 'numberStep' : item === 'code' ? 'verifyStep' : 'detailsStep'}`)}</Text>
              </View>
            ))}
          </View>

          <Text style={type.display} accessibilityRole="header">{t(`auth:${titles[step]}`)}</Text>
          <Text style={type.body}>{t(`auth:${intros[step]}`)}</Text>
          <FormError message={error} />

          {step === 'phone' ? (
            <View style={styles.form}>
              <FieldLabel>{t('auth:phone')}</FieldLabel>
              <Input value={phone} onChangeText={setPhone} accessibilityLabel={t('auth:phone')} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" autoFocus />
              <Text style={type.small}>{t('auth:phonePrivate')}</Text>
              {byEmail && emailAllowed ? <><FieldLabel>{t('auth:email')}</FieldLabel><Input value={email} onChangeText={setEmail} accessibilityLabel={t('auth:email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Text style={type.small}>{t('auth:emailHint')}</Text></> : null}
              <Button label={t(byEmail && emailAllowed ? 'auth:sendCodeEmail' : 'auth:sendCode')} onPress={() => void sendCode()} busy={busy} trailingIcon="arrow" />
              {emailAllowed ? <Button label={t(byEmail ? 'auth:useSmsInstead' : 'auth:useEmailInstead')} tone="quiet" onPress={() => { setByEmail(!byEmail); setError(null); }} disabled={busy} /> : null}
            </View>
          ) : step === 'code' && sent ? (
            <View style={styles.form}>
              <Text style={styles.notice}>{t(sent.email ? 'auth:codeSentEmail' : 'auth:codeSent', sent.email ? { email: sent.email } : { phone: sent.phone })}</Text>
              <FieldLabel>{t('auth:code')}</FieldLabel>
              <Input value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} accessibilityLabel={t('auth:code')} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} autoFocus />
              <Button label={t('auth:confirmCode')} onPress={() => void verifyCode()} busy={busy} trailingIcon="arrow" />
              <Button label={wait > 0 ? t('auth:resendIn', { seconds: wait }) : t('auth:resend')} tone="quiet" onPress={() => void resendCode()} disabled={busy || wait > 0} />
              <Button label={t('auth:changePhone')} tone="quiet" onPress={() => { setSent(null); setStep('phone'); setError(null); }} disabled={busy} />
            </View>
          ) : step === 'details' && sent ? (
            <View style={styles.form}>
              <View style={styles.verified}><Icon name="check" tint={color.green} size={22} /><Text style={[type.small, { flex: 1 }]}>{t(sent.email ? 'auth:emailConfirmedNext' : 'auth:phoneConfirmedNext', sent.email ? { email: sent.email } : { phone: sent.phone })}</Text></View>
              <FieldLabel>{t('auth:firstName')}</FieldLabel>
              <Input value={firstName} onChangeText={setFirstName} accessibilityLabel={t('auth:firstName')} autoComplete="given-name" autoFocus />
              <FieldLabel>{t('auth:lastName')}</FieldLabel>
              <Input value={lastName} onChangeText={setLastName} accessibilityLabel={t('auth:lastName')} autoComplete="family-name" />
              <FieldLabel>{t('auth:password')}</FieldLabel>
              <Input value={password} onChangeText={setPassword} accessibilityLabel={t('auth:password')} secureTextEntry={!showPassword} autoComplete="new-password" textContentType="newPassword" />
              <Text style={type.small}>{t('auth:passwordHint')}</Text>
              <Button label={t(showPassword ? 'auth:ui.hidePassword' : 'auth:ui.showPassword')} tone="quiet" onPress={() => setShowPassword(!showPassword)} />
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={styles.termsRow}>
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>{accepted ? <Icon name="check" size={16} tint={color.white} /> : null}</View>
                <Text style={[type.body, { flex: 1 }]}>{t('auth:acceptPlatformTerms')}</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/terms/[type]', params: { type: 'platform' } })} hitSlop={8}><Text style={styles.textLink}>{t('common:termsPlatform')}</Text></Pressable>
              <Button label={t('auth:signUp')} onPress={() => void finish()} busy={busy} trailingIcon="arrow" />
            </View>
          ) : null}

          <View style={styles.footer}><Text style={type.small}>{t('auth:haveAccount')}</Text><Pressable accessibilityRole="link" onPress={() => router.replace('/sign-in')} hitSlop={8}><Text style={styles.textLink}>{t('auth:signIn')}</Text></Pressable></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  logo: { width: 146, height: 35 },
  progress: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  progressItem: { flex: 1, gap: space.xs },
  progressBar: { height: 5, borderRadius: radius.pill, backgroundColor: color.sageStrong },
  progressBarActive: { backgroundColor: color.green },
  progressLabel: { ...type.caption, color: color.muted },
  progressLabelActive: { color: color.green },
  form: { gap: space.md, marginTop: space.sm },
  notice: { ...type.body, backgroundColor: color.sage, borderRadius: radius.md, padding: space.lg },
  verified: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.sage, borderRadius: radius.md, padding: space.md },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: color.green, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: color.green },
  textLink: { ...type.small, color: color.green, fontWeight: '700', textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.xs, paddingTop: space.md },
});
