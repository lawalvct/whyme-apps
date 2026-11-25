import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOrder } from '@whyme/data';
import { Icon } from '@/components/icon';
import { OrderActions } from '@/components/order-actions';
import { OrderProblem } from '@/components/order-problem';
import { OrderPayout } from '@/components/order-payout';
import { OrderDispute } from '@/components/order-dispute';
import { orderStatus } from '@/components/order-card';
import { EmptyState, IconButton, Pill, Reassurance, ui } from '@/components/ui';
import { formatDate, formatNaira } from '@/lib/format';
import { color, gutter, radius, space, type } from '@/theme';
import { mediaUrl } from '@/lib/api';

/** One order: what was bought, the money, how it is delivered, and what happened when. */
export default function OrderScreen() {
  const { t, i18n } = useTranslation(['common', 'orders']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const o = order.data;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => void order.refetch()} tintColor={color.green} />}>
        <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
          <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))} size={44} bordered={false} />
        </View>
        {!o ? (
          order.isPending ? null : <EmptyState icon="box" title={t('app.loadFailed')} />
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={[type.title, { flex: 1 }]} accessibilityRole="header">{t('orders:orderNumber', { number: o.number })}</Text>
              <Pill {...orderStatus(o, t)} />
            </View>

            <View style={[ui.card, styles.item]}>
              {o.thumb ? <Image source={{ uri: mediaUrl(o.thumb) }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.noThumb]}><Icon name="image" size={26} tint={color.faint} /></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.heading}>{o.title}</Text>
                <Text style={type.small}>{t('app.orders.qty', { count: o.quantity })} · {formatNaira(o.unit_price_kobo)}</Text>
                <Text style={type.small}>{o.role === 'buyer' ? t('app.orderDetail.from') : t('app.orderDetail.to')}: {o.other_party.name}</Text>
              </View>
            </View>

            <View style={[ui.card, styles.box]}>
              <Row label={t('app.orderDetail.subtotal')} value={formatNaira(o.subtotal_kobo)} />
              {o.delivery_fee_kobo > 0 ? <Row label={t('app.orderDetail.delivery')} value={formatNaira(o.delivery_fee_kobo)} /> : null}
              {o.buyer_fee_kobo > 0 ? <Row label={t('app.orderDetail.buyerFee')} value={formatNaira(o.buyer_fee_kobo)} /> : null}
              <View style={ui.divider} />
              <Row label={o.paid_at ? t('app.orderDetail.total') : t('orders:total')} value={formatNaira(o.total_kobo)} strong />
            </View>

            {o.kind === 'product' ? (
              <View style={[ui.card, styles.box, { flexDirection: 'row', alignItems: 'center', gap: space.md }]}>
                <Icon name={o.fulfilment_method === 'pickup' ? 'shop' : 'truck'} size={24} tint={color.green} />
                <View style={{ flex: 1 }}>
                  <Text style={type.bodyStrong}>{o.fulfilment_method === 'pickup' ? t('app.orders.pickup') : t('app.orders.delivery')}</Text>
                  {o.delivery?.area ? <Text style={type.small}>{o.delivery.area}</Text> : null}
                </View>
              </View>
            ) : null}

            {o.paid_at ? <Reassurance title={t('app.orders.paymentProtected')} /> : null}

            {o.events && o.events.length > 0 ? (
              <View style={[ui.card, styles.box]}>
                <Text style={type.heading}>{t('app.orderDetail.history')}</Text>
                {o.events.map((e, i) => (
                  <View key={i} style={styles.event}>
                    <View style={styles.eventDot} />
                    <Text style={[type.body, { flex: 1 }]}>{t(`orders:${e.domain === 'funds' ? 'eventFunds' : 'event'}.${e.to}`, { defaultValue: e.to.replace(/_/g, ' ') })}</Text>
                    {e.at ? <Text style={type.small}>{formatDate(e.at, i18n.language)}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            <OrderActions key={`${o.id}:${o.version}`} order={o} />
            <OrderProblem order={o} />
            <OrderDispute order={o} />
            <OrderPayout order={o} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={strong ? type.bodyStrong : type.body}>{label}</Text>
      <Text style={strong ? [type.price, { fontSize: 18 }] : type.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  item: { flexDirection: 'row', gap: space.lg, padding: space.lg },
  thumb: { width: 96, height: 76, borderRadius: radius.md, backgroundColor: color.field },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  box: { padding: space.lg, gap: space.sm },
  event: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.green },
});
