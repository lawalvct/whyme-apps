'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { applyServerErrors, ApiRequestError, queryKeys, unwrap, useApi, useConfig, useZodForm } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { otpSchema, passwordSchema, personNameSchema, phoneSchema } from '@whyme/schemas';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { prepareSession, webDevice } from '@/lib/api';
import { routes } from '@/lib/format';
import { translateFieldError, useT } from '@/lib/i18n';
import { AuthCard, AuthSteps, FormError } from './AuthCard';
import { useAuthDone, useNextParam } from './useAuthDone';
import { PasswordField } from './PasswordField';
import styles from './AuthCard.module.css';

/** The platform owner can switch email codes off from the admin console. */
const EMAIL_FLAG = 'signup_email_otp_enabled';

const phoneStep = z
  .object({ phone: phoneSchema, byEmail: z.boolean(), email: z.string().trim().toLowerCase() })
  .superRefine((values, ctx) => {
    if (values.byEmail && !z.email().safeParse(values.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'auth:emailInvalid' });
    }
  });
const codeStep = z.object({ code: otpSchema });
const detailsStep = z.object({
  first_name: personNameSchema,
  last_name: personNameSchema,
  password: passwordSchema,
  // The Platform Terms tick box (ACC07): the account isn't created without it.
  accept_terms: z.boolean().refine((v) => v, { message: 'auth:termsRequired' }),
});

/** Where the code went: always a phone, plus the email when the person chose email. */
type Destination = { phone: string; email: string | null };

/**
 * Progress kept in this tab (sessionStorage) for as long as the API's pass
 * lasts, so a reload or a dropped connection resumes at the same step instead
 * of asking for a new code. Nothing is stored after the account is created.
 */
type Progress = { sent: Destination; pass: string | null; savedAt: number };
const PROGRESS_KEY = 'whyme.signup';
const PROGRESS_TTL_MS = 30 * 60_000;

function loadProgress(): Progress | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(PROGRESS_KEY) ?? 'null') as Progress | null;
    return saved && Date.now() - saved.savedAt < PROGRESS_TTL_MS ? saved : null;
  } catch {
    return null;
  }
}

function saveProgress(progress: Progress | null) {
  try {
    if (progress) window.sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    else window.sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Private mode or blocked storage: sign-up still works, it just won't resume after a reload.
  }
}

/**
 * Sign-up in three steps (ACC02):
 * 1. phone number: a 6-digit code goes by SMS, or to an email the person gives
 *    instead (the phone number is still required);
 * 2. the code is confirmed on its own (POST /auth/otp/verify gives a one-time pass);
 * 3. name and password create the account and sign this browser in.
 */
export function SignUpForm() {
  const { t } = useT('auth');
  const next = useNextParam();
  const [sent, setSent] = useState<Destination | null>(null);
  const [pass, setPass] = useState<string | null>(null);
  const [restartReason, setRestartReason] = useState<string | null>(null);

  // After a reload: back to the step the person had reached in this tab.
  useEffect(() => {
    const saved = loadProgress();
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after hydration
    setSent(saved.sent);
    setPass(saved.pass);
  }, []);

  function codeSent(destination: Destination) {
    setRestartReason(null);
    setSent(destination);
    saveProgress({ sent: destination, pass: null, savedAt: Date.now() });
  }

  function codeConfirmed(newPass: string) {
    setPass(newPass);
    if (sent) saveProgress({ sent, pass: newPass, savedAt: Date.now() });
  }

  function restart(reason: string | null = null) {
    setPass(null);
    setSent(null);
    setRestartReason(reason);
    saveProgress(null);
  }

  return (
    <AuthCard
      title={t(!sent ? 'ui.signUpTitle' : !pass ? 'ui.verifyTitle' : 'ui.detailsTitle')}
      intro={t(!sent ? 'ui.signUpIntro' : !pass ? 'ui.verifyIntro' : 'ui.detailsIntro')}
      mode="signup"
      next={next}
      progress={<AuthSteps current={!sent ? 1 : !pass ? 2 : 3} />}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href={routes.signIn(next)} className="font-semibold text-primary hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      {!sent ? (
        <PhoneStep notice={restartReason} onSent={codeSent} />
      ) : !pass ? (
        <CodeStep sent={sent} onConfirmed={codeConfirmed} onChangePhone={() => restart()} />
      ) : (
        <DetailsStep sent={sent} pass={pass} onExpired={(message) => restart(message)} onDone={() => saveProgress(null)} />
      )}
    </AuthCard>
  );
}

function useSendCode() {
  const api = useApi();
  return async ({ phone, email }: Destination) => {
    const body = unwrap(
      await api.POST('/v1/auth/otp', {
        body: email ? { phone, purpose: 'register', channel: 'email', email } : { phone, purpose: 'register' },
      }),
    );
    return Number(body.data.resend_in) || 60;
  };
}

function useErrorText() {
  const { t } = useT('auth');
  // Sign-up isn't queued offline, so a dropped connection asks to try again (safe: the API never makes two accounts).
  return (e: unknown) => (e instanceof ApiRequestError ? t(errorKey(e.code)) : t('networkRetry'));
}

/** Step 1: the phone number, and optionally an email to send the code to instead. */
function PhoneStep({ notice, onSent }: { notice: string | null; onSent: (sent: Destination) => void }) {
  const { t } = useT('auth');
  const sendCode = useSendCode();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const config = useConfig();
  const emailAllowed = config.data?.features[EMAIL_FLAG] === true;
  const [error, setError] = useState<string | null>(notice);
  const form = useZodForm(phoneStep, { defaultValues: { phone: '', byEmail: false, email: '' } });
  const { errors, isSubmitting } = form.formState;
  const byEmail = form.watch('byEmail') && emailAllowed;

  const onSubmit = form.handleSubmit(async ({ phone, email }) => {
    setError(null);
    const sent = { phone, email: byEmail ? email : null };
    try {
      await sendCode(sent);
      onSent(sent);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'email_otp_disabled') {
        // Switched off since the page loaded: hide the option and go back to SMS.
        form.setValue('byEmail', false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.config });
      }
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className={styles.form}>
      <FormError message={error} />
      <TextField
        label={t('phone')}
        hint={t(byEmail ? 'phoneHint' : 'ui.verificationHint')}
        placeholder="0803 123 4567"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        error={errors.phone?.message ? t(errors.phone.message) : undefined}
        {...form.register('phone')}
      />
      {byEmail ? (
        <TextField
          label={t('email')}
          hint={t('emailHint')}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email?.message ? t(errors.email.message) : undefined}
          {...form.register('email')}
        />
      ) : null}
      <Button type="submit" disabled={isSubmitting} className={styles.primaryButton}>
        {isSubmitting ? t('common:loading') : byEmail ? t('sendCodeEmail') : t('sendCode')}
        <Icon name="arrow" />
      </Button>
      {emailAllowed ? (
        <Button
          variant="ghost"
          className={styles.alternateMethod}
          onClick={() => {
            setError(null);
            form.clearErrors('email');
            form.setValue('byEmail', !byEmail);
          }}
        >
          {byEmail ? t('useSmsInstead') : t('useEmailInstead')}
        </Button>
      ) : null}
    </form>
  );
}

/** Step 2: the 6-digit code is confirmed on its own; only then are name and password asked for. */
function CodeStep({
  sent,
  onConfirmed,
  onChangePhone,
}: {
  sent: Destination;
  onConfirmed: (pass: string) => void;
  onChangePhone: () => void;
}) {
  const { t } = useT('auth');
  const api = useApi();
  const sendCode = useSendCode();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(60);
  const form = useZodForm(codeStep, { defaultValues: { code: '' } });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const onSubmit = form.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const body = unwrap(await api.POST('/v1/auth/otp/verify', { body: { phone: sent.phone, purpose: 'register', code } }));
      onConfirmed(body.data.registration_token);
    } catch (e) {
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  async function resend() {
    setError(null);
    try {
      setWait(await sendCode(sent));
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate className={styles.form}>
      <p className={styles.codeNotice}>
        {sent.email ? t('codeSentEmail', { email: sent.email }) : t('codeSent', { phone: sent.phone })}{' '}
        <button type="button" onClick={onChangePhone} className="font-semibold text-primary hover:underline">
          {t('changePhone')}
        </button>
      </p>
      <FormError message={error} />
      <TextField
        className={styles.codeField}
        label={t('code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        error={errors.code?.message ? t(errors.code.message) : undefined}
        {...form.register('code')}
      />
      <Button type="submit" disabled={isSubmitting} className={styles.primaryButton}>
        {isSubmitting ? t('common:loading') : t('confirmCode')}
        <Icon name="arrow" />
      </Button>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={wait > 0}
        className={styles.resend}
      >
        {wait > 0 ? t('resendIn', { seconds: wait }) : t('resend')}
      </button>
    </form>
  );
}

/** Step 3: name and password, sent with the one-time pass from the confirmed code. */
function DetailsStep({
  sent,
  pass,
  onExpired,
  onDone,
}: {
  sent: Destination;
  pass: string;
  onExpired: (message: string) => void;
  onDone: () => void;
}) {
  const { t } = useT('auth');
  const api = useApi();
  const done = useAuthDone();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(detailsStep, { defaultValues: { first_name: '', last_name: '', password: '', accept_terms: false } });
  const fieldError = (message: string | undefined) => translateFieldError(t, message);
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await prepareSession();
      const body = unwrap(
        await api.POST('/v1/auth/register', { body: { ...values, accept_terms: true, phone: sent.phone, registration_token: pass, device: webDevice() } }),
      );
      onDone();
      done(body.data.user);
    } catch (e) {
      // The pass is used up or too old (30 minutes): start again with a new code.
      if (e instanceof ApiRequestError && e.code === 'registration_expired') return onExpired(errorText(e));
      if (!applyServerErrors(form, e)) setError(errorText(e));
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className={styles.form}>
      <p role="status" className={styles.verified}>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-5 shrink-0 fill-none stroke-current"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
        {sent.email ? t('emailConfirmedNext', { email: sent.email }) : t('phoneConfirmedNext', { phone: sent.phone })}
      </p>
      <FormError message={error} />
      <div className={styles.nameRow}>
        <TextField
          label={t('firstName')}
          autoComplete="given-name"
          autoFocus
          error={errors.first_name?.message ? fieldError(errors.first_name.message) : undefined}
          {...form.register('first_name')}
        />
        <TextField
          label={t('lastName')}
          autoComplete="family-name"
          error={errors.last_name?.message ? fieldError(errors.last_name.message) : undefined}
          {...form.register('last_name')}
        />
      </div>
      <PasswordField
        label={t('password')}
        hint={t('passwordHint')}
        autoComplete="new-password"
        error={errors.password?.message ? t(errors.password.message) : undefined}
        {...form.register('password')}
      />
      <div className="flex flex-col gap-1">
        <label className={styles.termsRow}>
          <input type="checkbox" {...form.register('accept_terms')} />
          <span>
            {t('acceptPlatformTerms')}{' '}
            <a href={routes.terms('platform')} target="_blank" rel="noopener noreferrer">
              {t('termsLink')}
            </a>
          </span>
        </label>
        <p className="text-xs text-text-muted">
          {t('privacyNote')}{' '}
          <a href={routes.privacy} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
            {t('common:privacyPolicy')}
          </a>
        </p>
        {errors.accept_terms?.message ? (
          <p role="alert" className="text-sm text-danger">
            {fieldError(errors.accept_terms.message)}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting} className={styles.primaryButton}>
        {isSubmitting ? t('common:loading') : t('signUp')}
        <Icon name="arrow" />
      </Button>
    </form>
  );
}
