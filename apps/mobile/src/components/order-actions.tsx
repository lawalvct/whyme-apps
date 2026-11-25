import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, paymentIsOpen, unwrap, useApi, type Order, type OrderAction } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { useOrderChat } from '@/lib/chat';
import { formatNaira } from '@/lib/format';
import { Button } from '@/components/ui';
import { color, radius, space, type } from '@/theme';
import { openPayment } from '@/lib/payments';

/** The actions available for this order's current role and state. */
export function OrderActions({ order }: { order: Order }) {
  const { t, i18n } = useTranslation(['orders', 'common', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const chat = useOrderChat(order);
  const lock = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'decline' | 'confirm' | 'cancel' | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const state = order.fulfilment_state;
  const buyer = order.role === 'buyer';
  const pickup = order.fulfilment_method === 'pickup';
  const total = formatNaira(order.total_kobo);

  async function run(action: OrderAction) {
    if (lock.current) return;
    if (action === 'decline' && note.trim().length < 5) {
      setNoteError(t('orders:declineReasonRequired'));
      return;
    }
    lock.current = true;
    setBusy(action);
    setError(null);
    try {
      const path = `/v1/orders/{order}/${action}` as '/v1/orders/{order}/accept';
      const fresh = unwrap(await api.POST(path, {
        params: { path: { order: order.id } },
        body: { version: order.version, note: note.trim() || null },
      })).data;
      queryClient.setQueryData(orderKeys.order(order.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      setConfirm(null);
      setNote('');
    } catch (cause) {
      const apiError = cause instanceof ApiRequestError ? cause : null;
      const current = (apiError?.body as { data?: Order } | null)?.data;
      if (apiError?.status === 409) {
        if (current) queryClient.setQueryData(orderKeys.order(order.id), current);
        else void queryClient.invalidateQueries({ queryKey: orderKeys.order(order.id) });
        setError(t('orders:changedMeanwhile'));
      } else {
        setError(t(errorKey(apiError?.code ?? 'network_error')));
      }
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function checkPayment() {
    if (lock.current) return;
    lock.current = true;
    setBusy('check');
    setError(null);
    try {
      const fresh = unwrap(await api.POST('/v1/orders/{order}/payment/check', { params: { path: { order: order.id } } })).data;
      queryClient.setQueryData(orderKeys.order(order.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    } catch (cause) {
      setError(t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error')));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function pay() {
    if (lock.current) return;
    lock.current = true;
    setBusy('pay');
    setError(null);
    try {
      const result = unwrap(await api.POST('/v1/orders/{order}/pay', {
        params: { path: { order: order.id } }, body: {}, headers: { 'Idempotency-Key': Crypto.randomUUID() },
      })).data;
      // Paystack in an in-app sheet; back in the app, ask the API whether it went through.
      if (result.checkout_url) await openPayment(result.checkout_url, () => void checkPayment());
      else void queryClient.invalidateQueries({ queryKey: orderKeys.order(order.id) });
    } catch (cause) {
      setError(t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error')));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <View style={styles.section}>
      {buyer && state === 'paid' ? <Text style={styles.guidance}>{t('orders:buyerPaidWaiting', { total })}</Text> : null}
      {buyer && state === 'accepted' ? <Text style={styles.guidance}>{t('orders:buyerAccepted')}</Text> : null}
      {buyer && state === 'dispatched' ? <Text style={styles.guidance}>{t(pickup ? 'orders:buyerDispatchedPickup' : 'orders:buyerDispatchedDelivery')}</Text> : null}
      {buyer && state === 'completion_submitted' ? <Text style={styles.guidance}>{t('orders:buyerDelivered')}</Text> : null}
      {!buyer && state === 'completion_submitted' ? <Text style={styles.guidance}>{t('orders:sellerWaitingConfirm')}</Text> : null}
      {(state === 'dispatched' || state === 'completion_submitted') && order.buyer_response_overdue ? <Text style={styles.guidance}>{t(buyer ? 'orders:deadlineOverdueBuyer' : 'orders:deadlineOverdueSeller')}</Text> : null}
      {(state === 'dispatched' || state === 'completion_submitted') && !order.buyer_response_overdue && order.confirm_due_at ? <Text style={type.small}>{t(buyer ? 'orders:deadlineBuyer' : 'orders:deadlineSeller', { date: new Intl.DateTimeFormat(i18n.language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium' }).format(new Date(order.confirm_due_at)) })}</Text> : null}
      {buyer && state === 'awaiting_payment' ? (
        <View style={styles.panel}>
          <Text style={type.bodyStrong}>{t('orders:awaitingBanner')}</Text>
          {order.payment?.state === 'pending_verification' || order.payment?.state === 'reconciliation_required' ? (
            <Text style={type.small}>{t(order.payment.state === 'pending_verification' ? 'orders:pendingBanner' : 'orders:reviewBanner')}</Text>
          ) : (
            <Button label={t('orders:continuePayment', { total })} onPress={() => void pay()} busy={busy === 'pay'} disabled={Boolean(busy)} />
          )}
          {paymentIsOpen(order.payment?.state) ? <Button label={t('orders:checkNow')} tone="outline" onPress={() => void checkPayment()} busy={busy === 'check'} disabled={Boolean(busy)} /> : null}
          {!order.paid_at && order.payment?.state !== 'pending_verification' && order.payment?.state !== 'reconciliation_required' ? (
            confirm === 'cancel' ? (
              <View style={styles.confirm}>
                <Text style={type.body}>{t('orders:cancelQuestion')}</Text>
                <Button label={t('orders:cancelYes')} tone="outline" onPress={() => void run('cancel')} busy={busy === 'cancel'} disabled={Boolean(busy)} />
                <Button label={t('orders:keepOrder')} tone="quiet" onPress={() => setConfirm(null)} disabled={Boolean(busy)} />
              </View>
            ) : <Button label={t('orders:cancelOrder')} tone="quiet" onPress={() => setConfirm('cancel')} disabled={Boolean(busy)} />
          ) : null}
        </View>
      ) : null}

      {!buyer && state === 'paid' ? (
        <View style={styles.panel}>
          <Text style={type.bodyStrong}>{t('orders:sellerPaidNext')}</Text>
          {confirm === 'decline' ? (
            <View style={styles.confirm}>
              <Text style={type.heading}>{t('orders:declineTitle')}</Text>
              <Text style={type.small}>{t('orders:declineHint')}</Text>
              <TextInput accessibilityLabel={t('orders:declineReason')} placeholder={t('orders:declineReason')} value={note} onChangeText={(value) => { setNote(value); setNoteError(null); }} multiline maxLength={300} style={styles.input} />
              {noteError ? <Text style={styles.error}>{noteError}</Text> : null}
              <Button label={t('orders:confirmDecline')} tone="outline" onPress={() => void run('decline')} busy={busy === 'decline'} disabled={Boolean(busy)} />
              <Button label={t('orders:keepOrder')} tone="quiet" onPress={() => setConfirm(null)} disabled={Boolean(busy)} />
            </View>
          ) : (
            <View style={styles.buttons}>
              <Button label={t('orders:accept')} onPress={() => void run('accept')} busy={busy === 'accept'} disabled={Boolean(busy)} style={styles.button} />
              <Button label={t('orders:decline')} tone="outline" onPress={() => { setNote(''); setConfirm('decline'); }} disabled={Boolean(busy)} style={styles.button} />
            </View>
          )}
        </View>
      ) : null}

      {!buyer && (state === 'accepted' || state === 'dispatched') ? (
        <View style={styles.panel}>
          <Text style={type.bodyStrong}>{t(state === 'accepted' ? 'orders:sellerAcceptedNext' : 'orders:sellerDispatchedNext')}</Text>
          <TextInput accessibilityLabel={t('orders:noteLabel')} placeholder={t('orders:noteLabel')} value={note} onChangeText={setNote} multiline maxLength={300} style={styles.input} />
          <Text style={type.small}>{t('orders:noteHint')}</Text>
          {state === 'accepted' ? <Button label={t(pickup ? 'orders:markReady' : 'orders:markSent')} onPress={() => void run('dispatch')} busy={busy === 'dispatch'} disabled={Boolean(busy)} /> : null}
          <Button label={t(pickup ? 'orders:markHandedOver' : 'orders:markDelivered')} tone={state === 'accepted' ? 'outline' : 'green'} onPress={() => void run('complete')} busy={busy === 'complete'} disabled={Boolean(busy)} />
        </View>
      ) : null}

      {buyer && (state === 'dispatched' || state === 'completion_submitted') ? (
        <View style={styles.panel}>
          <Text style={type.heading}>{t('orders:confirmTitle')}</Text>
          <Text style={type.small}>{t('orders:confirmHint', { total })}</Text>
          {order.dispute?.active ? <Text style={type.bodyStrong}>{t('orders:problem.confirmPaused')}</Text> : confirm === 'confirm' ? (
            <View style={styles.confirm}>
              <Text style={type.bodyStrong}>{t('orders:confirmQuestion', { total, seller: order.other_party.name })}</Text>
              <Button label={t('orders:confirmYes')} onPress={() => void run('confirm')} busy={busy === 'confirm'} disabled={Boolean(busy)} />
              <Button label={t('orders:notYet')} tone="quiet" onPress={() => setConfirm(null)} disabled={Boolean(busy)} />
            </View>
          ) : <Button label={t('orders:gotIt')} onPress={() => setConfirm('confirm')} disabled={Boolean(busy)} />}
          <Text style={type.small}>{t('orders:confirmProblem')}</Text>
        </View>
      ) : null}

      {chat.available && state !== 'cancelled' ? (
        <Button label={t(buyer ? 'orders:messageSeller' : 'common:app.orders.messageBuyer')} tone="outline" icon="message" onPress={() => void chat.open()} busy={chat.busy} />
      ) : null}
      {chat.error ? <Text style={styles.error} accessibilityRole="alert">{t(errorKey(chat.error))}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  guidance: { ...type.bodyStrong, backgroundColor: color.sage, borderRadius: radius.md, padding: space.md },
  panel: { backgroundColor: color.sage, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  confirm: { backgroundColor: color.white, borderRadius: radius.md, padding: space.md, gap: space.md },
  buttons: { flexDirection: 'row', gap: space.sm },
  button: { flex: 1 },
  input: { minHeight: 82, borderColor: color.border, borderWidth: 1, borderRadius: radius.md, backgroundColor: color.white, padding: space.md, fontSize: 16, color: color.ink, textAlignVertical: 'top' },
  error: { color: color.danger, fontSize: 14 },
});
