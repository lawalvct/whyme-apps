import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, chatKeys, orderKeys, requestKeys, unwrap, useApi, useServiceRequest, type ServiceRequest } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Button, EmptyState, FieldLabel, FormError, IconButton, Input, ListLoading, Pill, ui } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { startConversation } from '@/lib/chat';
import { formatDate, formatDateTime, formatNaira, groupDigits, nairaToKobo } from '@/lib/format';
import { openPayment } from '@/lib/payments';
import { requestStatus } from '@/lib/requests';
import { color, gutter, radius, space, type } from '@/theme';

/** The requests list (requests/index.tsx); the generated route types only know it as /requests/index. */
const REQUESTS = '/requests' as Href;

type ActionPath =
  | '/v1/requests/{serviceRequest}/accept'
  | '/v1/requests/{serviceRequest}/decline'
  | '/v1/requests/{serviceRequest}/start'
  | '/v1/requests/{serviceRequest}/complete'
  | '/v1/requests/{serviceRequest}/confirm'
  | '/v1/requests/{serviceRequest}/cancel';

/**
 * One service request (REQ-01, REQ-03, REQ-04). The provider accepts or declines, prices the job
 * (quote v1, v2…), starts and finishes it; the customer accepts a price or asks for another, pays
 * the agreed amount into WHY ME protection, and confirms when the work is done. Every write sends
 * the version on screen and an Idempotency-Key; a change made elsewhere shows the latest instead.
 */
export default function RequestScreen() {
  const { t, i18n } = useTranslation(['requests', 'common', 'errors', 'orders']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const request = useServiceRequest(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const working = useRef(false);
  const actionKey = useRef<{ signature: string; key: string } | null>(null);
  const r = request.data;

  /** Runs one write; a 409 brings the current request back and says it changed meanwhile. */
  async function write(signature: string, call: (key: string) => Promise<ServiceRequest>): Promise<boolean> {
    if (working.current) return false;
    if (actionKey.current?.signature !== signature) actionKey.current = { signature, key: Crypto.randomUUID() };
    working.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      queryClient.setQueryData(requestKeys.request(id), await call(actionKey.current.key));
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      return true;
    } catch (e) {
      const apiError = e instanceof ApiRequestError ? e : null;
      const current = (apiError?.body as { data?: ServiceRequest } | null)?.data;
      if (apiError?.status === 409 && current) {
        queryClient.setQueryData(requestKeys.request(id), current);
        setNotice(t('changedMeanwhile'));
      } else {
        setError(Object.values(apiError?.body?.fields ?? {})[0]?.[0] ?? t(errorKey(apiError?.code ?? 'network_error')));
      }
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const act = (path: ActionPath, extra: { note?: string | null; reason?: string } = {}) =>
    write(`${path}:${JSON.stringify(extra)}`, async (key) =>
      unwrap(await api.POST(path, { params: { path: { serviceRequest: id } }, body: { version: r!.version, ...extra } as never, headers: { 'Idempotency-Key': key } })).data as ServiceRequest,
    );

  const sendQuote = (payload: { amount_kobo: number; scope: string; estimated_days: number | null }) =>
    write(`quote:${JSON.stringify(payload)}`, async (key) =>
      unwrap(await api.POST('/v1/requests/{serviceRequest}/quotes', { params: { path: { serviceRequest: id } }, body: { version: r!.version, ...payload }, headers: { 'Idempotency-Key': key } })).data as ServiceRequest,
    );

  const onQuote = (quoteId: string, action: 'accept' | 'decline', note?: string | null) => {
    const path = action === 'accept' ? ('/v1/requests/{serviceRequest}/quotes/{quote}/accept' as const) : ('/v1/requests/{serviceRequest}/quotes/{quote}/decline' as const);
    return write(`${path}:${quoteId}:${note ?? ''}`, async (key) =>
      unwrap(await api.POST(path, { params: { path: { serviceRequest: id, quote: quoteId } }, body: { version: r!.version, ...(note !== undefined ? { note } : {}) } as never, headers: { 'Idempotency-Key': key } })).data as ServiceRequest,
    );
  };

  async function pay() {
    if (working.current || !r) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = unwrap(await api.POST('/v1/requests/{serviceRequest}/pay', { params: { path: { serviceRequest: id } }, body: {}, headers: { 'Idempotency-Key': Crypto.randomUUID() } })).data as { checkout_url?: string | null; request?: ServiceRequest };
      if (result.request) queryClient.setQueryData(requestKeys.request(id), result.request);
      const orderId = result.request?.order?.id ?? r.order?.id;
      if (result.checkout_url) {
        await openPayment(result.checkout_url, () => {
          void (async () => {
            if (orderId) await api.POST('/v1/orders/{order}/payment/check', { params: { path: { order: orderId } } }).catch(() => undefined);
            await queryClient.invalidateQueries({ queryKey: requestKeys.all });
            void queryClient.invalidateQueries({ queryKey: orderKeys.all });
          })();
        });
      }
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function message() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const conversation = await startConversation(api, { type: 'service_request', id });
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.bar}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace(REQUESTS))} size={44} bordered={false} />
      </View>
      {request.isPending ? (
        <ListLoading />
      ) : !r ? (
        <EmptyState icon="tools" title={t('requestLoadFailed')} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={request.isRefetching} onRefresh={() => void request.refetch()} tintColor={color.green} />}>
            <View style={{ gap: space.xs }}>
              <View style={styles.row}>
                <Text style={[type.small, { flex: 1 }]}>{t('requestNumber', { number: r.number })}</Text>
                <Pill {...requestStatus(r, t)} />
              </View>
              <Text style={type.title} accessibilityRole="header">{r.title}</Text>
              <Text style={type.small}>{r.role === 'provider' ? t('customer') : t('provider')}: {r.other_party.name}</Text>
            </View>

            <Banner request={r} />
            {notice ? <Text style={[type.small, styles.notice]} accessibilityRole="alert">{notice}</Text> : null}
            <FormError message={error} />

            <Quotes request={r} busy={busy} onSend={sendQuote} onQuote={onQuote} />
            <Payment request={r} busy={busy} onPay={() => void pay()} />
            {r.role === 'provider' ? <ProviderActions request={r} busy={busy} act={act} /> : <CustomerActions request={r} busy={busy} act={act} />}
            <Button label={r.role === 'provider' ? t('messageCustomer') : t('messageProvider')} tone="outline" icon="message" disabled={busy} onPress={() => void message()} />
            <CancelRequest request={r} busy={busy} act={act} />

            <Details request={r} />
            {r.events && r.events.length > 0 ? (
              <Card title={t('history')}>
                {r.events.map((e, i) => (
                  <View key={i} style={styles.event}>
                    <View style={styles.dot} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.body}>
                        {t(`event.${e.to}`, { defaultValue: e.to.replace(/_/g, ' '), version: e.quote_version ?? '', amount: e.amount_kobo != null ? formatNaira(e.amount_kobo) : '' })}
                      </Text>
                      {e.at ? <Text style={type.small}>{formatDateTime(e.at, i18n.language)}</Text> : null}
                      {e.note ? <Text style={type.small}>“{e.note}”</Text> : null}
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Card({ title, children, tone }: { title?: string; children: ReactNode; tone?: 'sage' | 'gold' }) {
  return (
    <View style={[ui.card, styles.card, tone === 'sage' && { backgroundColor: color.sage, borderColor: '#E1EEE4' }, tone === 'gold' && { backgroundColor: color.goldSoft, borderColor: '#F3D9A6' }]}>
      {title ? <Text style={type.heading} accessibilityRole="header">{title}</Text> : null}
      {children}
    </View>
  );
}

/** What is happening now, in the reader's words. */
function Banner({ request: r }: { request: ServiceRequest }) {
  const { t } = useTranslation('requests');
  const s = r.status;
  const latest = r.latest_quote;
  let text: string;
  if (s === 'held') text = t('heldBanner');
  else if (s === 'rejected') text = t('rejectedBanner', { reason: r.rejection_reason ?? '' });
  else if (r.role === 'provider') {
    text =
      s === 'submitted' ? t('providerSubmittedBanner', { customer: r.other_party.name })
        : s === 'accepted' ? latest?.status === 'sent' ? t('providerQuoteWaiting', { amount: formatNaira(latest.amount_kobo), version: latest.version, customer: r.other_party.name }) : latest?.status === 'rejected' ? t('providerQuoteRejected', { customer: r.other_party.name, version: latest.version, amount: formatNaira(latest.amount_kobo) }) : r.agreed_amount_kobo != null && latest ? t('providerQuoteAccepted', { customer: r.other_party.name, amount: formatNaira(r.agreed_amount_kobo), version: latest.version }) : t('providerAcceptedBanner')
        : s === 'in_progress' ? t('providerInProgressBanner')
        : s === 'completion_submitted' ? t('providerCompletionSubmittedBanner', { customer: r.other_party.name })
        : s === 'completed' ? t('providerCompletedBanner', { customer: r.other_party.name })
        : s === 'declined' ? t('providerDeclinedBanner')
        : t('providerCancelledBanner', { customer: r.other_party.name });
  } else {
    text =
      s === 'submitted' ? latest?.status === 'sent' ? t('customerQuoteWaiting', { provider: r.other_party.name, amount: formatNaira(latest.amount_kobo) }) : t('customerSubmittedBanner', { provider: r.other_party.name })
        : s === 'accepted' ? latest?.status === 'sent' ? t('customerQuoteWaiting', { provider: r.other_party.name, amount: formatNaira(latest.amount_kobo) }) : r.agreed_amount_kobo != null && latest ? t('customerQuoteAccepted', { amount: formatNaira(r.agreed_amount_kobo), version: latest.version }) : t('customerAcceptedBanner', { provider: r.other_party.name })
        : s === 'in_progress' ? t('customerInProgressBanner', { provider: r.other_party.name })
        : s === 'completion_submitted' ? t('customerCompletionSubmittedBanner', { provider: r.other_party.name })
        : s === 'completed' ? t('customerCompletedBanner')
        : s === 'declined' ? t('customerDeclinedBanner', { provider: r.other_party.name })
        : t('customerCancelledBanner');
  }
  return <Text style={[type.body, styles.banner, (s === 'declined' || s === 'cancelled' || s === 'rejected') && { backgroundColor: color.field }]}>{text}</Text>;
}

/** The price: the latest quote, the provider's quote editor, and the customer's answer. */
function Quotes({ request: r, busy, onSend, onQuote }: {
  request: ServiceRequest;
  busy: boolean;
  onSend: (payload: { amount_kobo: number; scope: string; estimated_days: number | null }) => Promise<boolean>;
  onQuote: (quoteId: string, action: 'accept' | 'decline', note?: string | null) => Promise<boolean>;
}) {
  const { t } = useTranslation('requests');
  const latest = r.latest_quote;
  const open = r.status === 'submitted' || r.status === 'accepted';
  const [revising, setRevising] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askNote, setAskNote] = useState('');
  const canQuote = r.role === 'provider' && open && r.agreed_amount_kobo == null;
  const showEditor = canQuote && (latest == null || latest.status === 'rejected' || revising);
  if (!latest && !showEditor) return null;

  return (
    <Card title={t('quoteTitle')}>
      {latest ? (
        <View style={styles.quote}>
          <View style={styles.row}>
            <Text style={[type.price, { flex: 1 }]}>{formatNaira(latest.amount_kobo)}</Text>
            <Pill label={`${t('quoteVersion', { version: latest.version })} · ${t(`quoteStatus.${latest.status}`)}`} tone={latest.status === 'accepted' ? 'green' : latest.status === 'sent' ? 'gold' : 'grey'} />
          </View>
          <Text style={type.body}>{latest.scope}</Text>
          {latest.estimated_days ? <Text style={type.small}>{t('estimatedDays', { count: latest.estimated_days })}</Text> : null}
        </View>
      ) : null}

      {r.role === 'customer' && latest?.status === 'sent' && open ? (
        asking ? (
          <View style={{ gap: space.sm }}>
            <Text style={type.bodyStrong}>{t('declineQuoteTitle')}</Text>
            <Text style={type.small}>{t('declineQuoteHint')}</Text>
            <Input value={askNote} onChangeText={setAskNote} accessibilityLabel={t('declineQuoteNoteLabel')} placeholder={t('declineQuoteNoteLabel')} multiline maxLength={500} />
            <Button label={t('confirmDeclineQuote')} tone="outline" busy={busy} onPress={() => void onQuote(latest.id, 'decline', askNote.trim() || null).then((ok) => ok && setAsking(false))} />
            <Button label={t('cancelRevise')} tone="quiet" disabled={busy} onPress={() => setAsking(false)} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Button label={busy ? t('acceptingQuote') : t('acceptQuoteButton', { amount: formatNaira(latest.amount_kobo) })} busy={busy} onPress={() => void onQuote(latest.id, 'accept')} />
            <Button label={t('declineQuoteButton')} tone="outline" disabled={busy} onPress={() => setAsking(true)} />
          </View>
        )
      ) : null}

      {canQuote && latest?.status === 'sent' && !revising ? <Button label={t('openReviseQuote')} tone="quiet" disabled={busy} onPress={() => setRevising(true)} /> : null}
      {showEditor ? <QuoteEditor busy={busy} revising={Boolean(latest)} onCancel={latest ? () => setRevising(false) : undefined} onSend={(p) => onSend(p).then((ok) => { if (ok) setRevising(false); return ok; })} /> : null}
    </Card>
  );
}

function QuoteEditor({ busy, revising, onSend, onCancel }: { busy: boolean; revising: boolean; onSend: (p: { amount_kobo: number; scope: string; estimated_days: number | null }) => Promise<boolean>; onCancel?: () => void }) {
  const { t } = useTranslation('requests');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState('');
  const [days, setDays] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const kobo = nairaToKobo(amount);

  function send() {
    const found: Record<string, string> = {};
    if (kobo == null || Number.isNaN(kobo) || kobo < 100) found.amount = t('quoteAmountInvalid');
    if (scope.trim().length < 5) found.scope = t('quoteScopeRequired');
    if (days !== '' && !(Number(days) >= 1 && Number(days) <= 365)) found.days = t('estimatedDaysInvalid');
    setFields(found);
    if (Object.keys(found).length > 0) return;
    void onSend({ amount_kobo: kobo!, scope: scope.trim(), estimated_days: days === '' ? null : Number(days) });
  }

  const label = kobo && !Number.isNaN(kobo) ? (revising ? t('sendRevisedQuoteWithAmount', { amount: formatNaira(kobo), version: '' }) : t('sendQuoteWithAmount', { amount: formatNaira(kobo) })) : revising ? t('sendRevisedQuoteButton') : t('sendQuoteButton');
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.bodyStrong}>{revising ? t('reviseQuoteTitle') : t('sendQuoteTitle')}</Text>
      <Text style={type.small}>{t('sendQuoteHint')}</Text>
      <FieldLabel>{t('quoteAmountLabel')}</FieldLabel>
      <Input value={amount} onChangeText={(v) => setAmount(groupDigits(v))} accessibilityLabel={t('quoteAmountLabel')} keyboardType="number-pad" placeholder="0" error={fields.amount} />
      <FieldLabel>{t('quoteScopeLabel')}</FieldLabel>
      <Input value={scope} onChangeText={setScope} accessibilityLabel={t('quoteScopeLabel')} placeholder={t('quoteScopeHint')} multiline maxLength={2000} error={fields.scope} />
      <FieldLabel>{t('estimatedDaysLabel')}</FieldLabel>
      <Input value={days} onChangeText={(v) => setDays(v.replace(/\D/g, '').slice(0, 3))} accessibilityLabel={t('estimatedDaysLabel')} keyboardType="number-pad" error={fields.days} />
      <Button label={busy ? t('sendingQuote') : label} busy={busy} onPress={send} />
      {onCancel ? <Button label={t('cancelRevise')} tone="quiet" disabled={busy} onPress={onCancel} /> : null}
    </View>
  );
}

/** Paying the agreed amount into WHY ME protection, and where that money is afterwards. */
function Payment({ request: r, busy, onPay }: { request: ServiceRequest; busy: boolean; onPay: () => void }) {
  const { t } = useTranslation(['requests', 'orders']);
  if (r.agreed_amount_kobo == null || ['cancelled', 'declined', 'rejected'].includes(r.status)) return null;
  const amount = formatNaira(r.agreed_amount_kobo);
  const order = r.order as (ServiceRequest['order'] & { paid_at?: string | null; funds_state?: string }) | null;
  const paid = Boolean(order?.paid_at);
  if (!paid && r.role !== 'customer') return null;
  const funds = order?.funds_state ?? 'held';
  const body = !paid
    ? t('protectedPaymentUnpaidBody', { amount, provider: r.other_party.name })
    : funds === 'released' || funds === 'payout_reserved'
      ? t('paymentReleasedBody', { amount })
      : funds === 'release_eligible'
        ? t('paymentReleaseEligibleBody', { amount })
        : r.role === 'provider'
          ? t('paymentHeldProviderBody', { customer: r.other_party.name, amount })
          : t('paymentHeldBody', { provider: r.other_party.name, amount });
  return (
    <Card title={t('protectedPaymentTitle')} tone="sage">
      <Text style={type.body}>{body}</Text>
      {!paid ? <Button label={busy ? t('openingPayment') : t('payAgreedAmount', { amount })} tone="gold" icon="shield" busy={busy} onPress={onPay} /> : null}
      {order ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}>
          <Text style={styles.link}>{t('viewProtectedOrder', { number: order.number })}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function ProviderActions({ request: r, busy, act }: { request: ServiceRequest; busy: boolean; act: (path: ActionPath, extra?: { note?: string | null; reason?: string }) => Promise<boolean> }) {
  const { t } = useTranslation('requests');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (r.status === 'submitted') {
    return declining ? (
      <Card title={t('declineTitle')}>
        <Text style={type.small}>{t('declineHint')}</Text>
        <Input value={reason} onChangeText={setReason} accessibilityLabel={t('declineReason')} placeholder={t('declineReason')} multiline maxLength={300} error={reasonError ?? undefined} />
        <Button label={t('confirmDecline')} tone="outline" busy={busy} onPress={() => (reason.trim().length < 5 ? setReasonError(t('declineReasonRequired')) : void act('/v1/requests/{serviceRequest}/decline', { reason: reason.trim() }))} />
        <Button label={t('keepRequest')} tone="quiet" disabled={busy} onPress={() => setDeclining(false)} />
      </Card>
    ) : (
      <Card>
        <Text style={type.small}>{t('acceptHint')}</Text>
        <Button label={busy ? t('accepting') : t('accept')} busy={busy} onPress={() => void act('/v1/requests/{serviceRequest}/accept')} />
        <Button label={t('decline')} tone="outline" disabled={busy} onPress={() => setDeclining(true)} />
      </Card>
    );
  }
  if (r.status === 'accepted') {
    // As on the website and the server: once a price is sent, work starts only after the customer accepts one.
    if (r.accepted_quote_id === null && r.quotes.length > 0) return null;
    return <Button label={busy ? t('startingWork') : t('startWork')} busy={busy} onPress={() => void act('/v1/requests/{serviceRequest}/start')} />;
  }
  if (r.status === 'in_progress') {
    return (
      <Card>
        <FieldLabel>{t('noteLabel')}</FieldLabel>
        <Input value={note} onChangeText={setNote} accessibilityLabel={t('noteLabel')} placeholder={t('noteHint')} multiline maxLength={300} />
        <Button label={busy ? t('markingComplete') : t('markComplete')} busy={busy} onPress={() => void act('/v1/requests/{serviceRequest}/complete', { note: note.trim() || null })} />
      </Card>
    );
  }
  return null;
}

function CustomerActions({ request: r, busy, act }: { request: ServiceRequest; busy: boolean; act: (path: ActionPath, extra?: { note?: string | null }) => Promise<boolean> }) {
  const { t } = useTranslation('requests');
  const [confirming, setConfirming] = useState(false);
  if (r.status !== 'completion_submitted') return null;
  return (
    <Card title={t('confirmTitle')} tone="sage">
      <Text style={type.small}>{t('confirmHint')}</Text>
      {confirming ? (
        <>
          <Text style={type.bodyStrong}>{t('confirmQuestion', { provider: r.other_party.name })}</Text>
          <Button label={busy ? t('confirming') : t('confirmYes')} busy={busy} onPress={() => void act('/v1/requests/{serviceRequest}/confirm')} />
          <Button label={t('notYet')} tone="quiet" disabled={busy} onPress={() => setConfirming(false)} />
        </>
      ) : (
        <Button label={t('confirmButton')} onPress={() => setConfirming(true)} />
      )}
    </Card>
  );
}

/** The customer can cancel until they pay. Kept last, under "Message provider", so it is never the first tap. */
function CancelRequest({ request: r, busy, act }: { request: ServiceRequest; busy: boolean; act: (path: ActionPath, extra?: { note?: string | null }) => Promise<boolean> }) {
  const { t } = useTranslation('requests');
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState('');
  const order = r.order as (ServiceRequest['order'] & { paid_at?: string | null }) | null;
  const canCancel = r.role !== 'provider' && !order?.paid_at && (r.status === 'held' || r.status === 'submitted' || r.status === 'accepted');
  if (!canCancel) return null;
  return cancelling ? (
    <Card title={t('cancelQuestion')}>
      <Input value={note} onChangeText={setNote} accessibilityLabel={t('cancelNoteLabel')} placeholder={t('cancelNoteLabel')} multiline maxLength={300} />
      <Button label={busy ? t('cancelling') : t('cancelYes')} tone="outline" busy={busy} onPress={() => void act('/v1/requests/{serviceRequest}/cancel', { note: note.trim() || null })} />
      <Button label={t('keepRequest')} tone="quiet" disabled={busy} onPress={() => setCancelling(false)} />
    </Card>
  ) : (
    <Button label={t('cancelRequest')} tone="quiet" onPress={() => setCancelling(true)} />
  );
}

function Details({ request: r }: { request: ServiceRequest }) {
  const { t, i18n } = useTranslation(['requests', 'common']);
  // Same as the website's row: the label already says "Customer budget".
  const budget =
    r.budget_min_kobo != null && r.budget_max_kobo != null ? `${formatNaira(r.budget_min_kobo)} – ${formatNaira(r.budget_max_kobo)}`
      : r.budget_min_kobo != null ? formatNaira(r.budget_min_kobo)
        : r.budget_max_kobo != null ? formatNaira(r.budget_max_kobo) : null;
  const timing = [r.preferred_date ? formatDate(`${r.preferred_date}T12:00:00+01:00`, i18n.language) : null, r.preferred_time ? t(`time.${r.preferred_time}`) : null].filter(Boolean).join(' · ');
  return (
    <Card title={t('detailsTitle')}>
      <Text style={type.body}>{r.description}</Text>
      <Line label={t('category')} value={r.category.name} />
      <Line label={t('location')} value={r.location.name} />
      {timing ? <Line label={t('preferredTiming')} value={timing} /> : null}
      {budget ? <Line label={t('budget')} value={budget} /> : null}
      {r.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {r.photos.map((p) => (
            <Image key={p.id} source={{ uri: mediaUrl(p.urls.medium ?? p.urls.thumb) }} style={styles.photo} contentFit="cover" />
          ))}
        </ScrollView>
      ) : null}
      {r.listing ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/listing/[id]', params: { id: r.listing!.id } })}>
          <Text style={styles.link}>{t('viewListing')}</Text>
        </Pressable>
      ) : r.profile ? (
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/profile/[id]', params: { id: r.profile!.id } })}>
          <Text style={styles.link}>{t('viewProfile')}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={type.small}>{label}</Text>
      <Text style={[type.body, { flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  bar: { flexDirection: 'row', paddingHorizontal: space.sm, paddingVertical: space.xs },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  banner: { padding: space.md, borderRadius: radius.md, backgroundColor: color.sage },
  notice: { padding: space.md, borderRadius: radius.md, backgroundColor: color.goldSoft, color: color.ink },
  card: { padding: space.lg, gap: space.sm },
  quote: { gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: color.field },
  link: { fontSize: 15, fontWeight: '700', color: color.green },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.green, marginTop: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  photo: { width: 120, height: 100, borderRadius: radius.md, backgroundColor: color.field },
});
