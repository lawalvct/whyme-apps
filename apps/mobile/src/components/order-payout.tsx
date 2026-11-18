import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, payoutKeys, unwrap, useApi, usePayoutBreakdown, type Order } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Button, ListLoading } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { color, radius, space, type } from '@/theme';

/** The seller's net amount, bank destination and payout request for a completed sale. */
export function OrderPayout({ order }: { order: Order }) {
  const { t, i18n } = useTranslation(['orders', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const show = order.role === 'seller' && order.fulfilment_state === 'completed' && !order.dispute?.active;
  const breakdown = usePayoutBreakdown(order.id, show);
  const lock = useRef(false);
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!show) return null;
  if (breakdown.isPending) return <ListLoading />;
  if (!breakdown.data) return <Text style={styles.error}>{t('orders:payout.loadFailed')}</Text>;

  const b = breakdown.data;
  const amount = formatNaira(b.you_receive_kobo);

  async function request() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    key.current ??= Crypto.randomUUID();
    try {
      const fresh = unwrap(await api.POST('/v1/orders/{order}/payout', {
        params: { path: { order: order.id } },
        headers: { 'Idempotency-Key': key.current },
      })).data;
      queryClient.setQueryData(payoutKeys.order(order.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.order(order.id) });
      void queryClient.invalidateQueries({ queryKey: payoutKeys.earnings });
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) void breakdown.refetch();
      setError(t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error')));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={type.heading}>{b.request ? t('orders:payout.requested', { amount, date: b.request.requested_at ? new Date(b.request.requested_at).toLocaleDateString(i18n.language === 'ig' ? 'ig-NG' : 'en-NG') : '' }) : t('orders:payout.readyTitle', { amount })}</Text>
      <View style={styles.amounts}>
        <Line label={t('orders:payout.sale')} value={formatNaira(b.sale_kobo)} />
        {b.refunded_kobo > 0 ? <Line label={t('orders:payout.refunded')} value={`−${formatNaira(b.refunded_kobo)}`} /> : null}
        <Line label={t('orders:payout.commission', { rate: (b.commission_bps / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 }) })} value={`−${formatNaira(b.commission_kobo)}`} />
        <View style={styles.rule} />
        <Line label={t('orders:payout.youReceive')} value={amount} strong />
      </View>
      {b.bank ? <Text style={type.small}>{t('orders:payout.toBank', { bank: b.bank.bank_name, last4: b.bank.account_last4, name: b.bank.account_name })}</Text> : null}
      {!b.request && b.blockers.map((code) => <Text key={code} style={type.small}>{t(`orders:payout.blocker.${code}`, { defaultValue: t('orders:payout.blocker.other') })}</Text>)}
      {b.can_request ? (
        <>
          <Text style={type.small}>{t('orders:payout.requestHint')}</Text>
          <Button label={t('orders:payout.request', { amount })} onPress={() => void request()} busy={busy} />
        </>
      ) : null}
      {b.request ? <Text style={type.small}>{t('orders:payout.requestedNext')}</Text> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.line}><Text style={strong ? type.bodyStrong : type.small}>{label}</Text><Text style={strong ? type.bodyStrong : type.small}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  panel: { padding: space.lg, gap: space.md, borderRadius: radius.xl, backgroundColor: color.sage },
  amounts: { padding: space.md, gap: space.sm, borderRadius: radius.md, backgroundColor: color.white },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rule: { height: 1, backgroundColor: color.border },
  error: { color: color.danger, fontSize: 14 },
});
