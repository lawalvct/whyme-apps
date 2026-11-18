import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Order } from '@whyme/data';
import { Icon } from '@/components/icon';
import { Button, Pill, ui } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { color, radius, space, type } from '@/theme';

type Status = { label: string; tone: 'gold' | 'green' | 'grey' | 'red' };

/** What the order is doing now, in the buyer's or the seller's words. */
export function orderStatus(order: Order, t: (key: string) => string): Status {
  const seller = order.role === 'seller';
  switch (order.fulfilment_state) {
    case 'awaiting_payment':
      return { label: t('app.orders.awaitingPayment'), tone: 'grey' };
    case 'paid':
      return { label: seller ? t('app.orders.newOrder') : t('app.orders.paid'), tone: 'gold' };
    case 'accepted':
    case 'in_progress':
      return { label: t('app.orders.accepted'), tone: 'gold' };
    case 'dispatched':
      return { label: order.fulfilment_method === 'pickup' ? t('app.orders.readyForPickup') : t('app.orders.onTheWay'), tone: 'gold' };
    case 'completion_submitted':
      return { label: t('app.orders.toConfirm'), tone: 'gold' };
    case 'completed':
      return { label: t('app.orders.completed'), tone: 'green' };
    default:
      return { label: t('app.orders.cancelled'), tone: 'red' };
  }
}

const STEPS = ['placed', 'paid', 'sent', 'received'] as const;

/** How far along the four approved steps an order is: Placed, Paid, Sent, Received. */
function reached(order: Order): number {
  if (order.fulfilment_state === 'completed') return 4;
  if (order.fulfilment_state === 'dispatched' || order.fulfilment_state === 'completion_submitted') return 3;
  if (order.paid_at) return 2;
  return 1;
}

/** One order on the Orders tab, as in the approved design. */
export function OrderCard({ order }: { order: Order }) {
  const { t } = useTranslation(['common', 'orders']);
  const status = orderStatus(order, t);
  const done = order.fulfilment_state === 'completed';
  const cancelled = order.fulfilment_state === 'cancelled';
  const step = reached(order);
  const open = () => router.push({ pathname: '/orders/[id]', params: { id: order.id } });

  return (
    <View style={[ui.card, styles.card]}>
      <View style={styles.header}>
        <Icon name="box" size={22} tint={color.forest} />
        <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={1}>{t('orders:orderNumber', { number: order.number })}</Text>
        <Pill label={status.label} tone={status.tone} />
      </View>
      <View style={ui.divider} />

      <Pressable accessibilityRole="button" onPress={open} style={styles.item}>
        {order.thumb ? <Image source={{ uri: order.thumb }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.noThumb]}><Icon name="image" size={26} tint={color.faint} /></View>}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.heading} numberOfLines={2}>{order.title}</Text>
          <Text style={type.price}>{formatNaira(order.total_kobo)}</Text>
          <View style={styles.meta}>
            <Icon name="shop" size={18} tint={color.forest} />
            <Text style={[type.small, { flexShrink: 1 }]} numberOfLines={1}>{order.other_party.name}</Text>
            <View style={styles.metaRule} />
            <Text style={type.small}>{t('app.orders.qty', { count: order.quantity })}</Text>
          </View>
        </View>
      </Pressable>

      {done ? (
        <>
          <View style={ui.divider} />
          <View style={styles.doneRow}>
            <Icon name="checkCircle" size={24} tint={color.green} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>{t('app.orders.receivedConfirmed')}</Text>
            <Pressable accessibilityRole="link" onPress={open} hitSlop={8} style={styles.details}>
              <Text style={styles.detailsText}>{t('app.orders.viewDetails')}</Text>
              <Icon name="arrow" size={18} tint={color.green} />
            </Pressable>
          </View>
        </>
      ) : cancelled ? null : (
        <>
          <View style={ui.divider} />
          {order.kind === 'product' ? (
            <View style={styles.method}>
              <Icon name={order.fulfilment_method === 'pickup' ? 'shop' : 'truck'} size={24} tint={color.green} />
              <Text style={type.body}>{order.fulfilment_method === 'pickup' ? t('app.orders.pickup') : t('app.orders.delivery')}</Text>
            </View>
          ) : null}
          <View style={styles.steps} accessibilityLabel={STEPS.slice(0, step).map((s) => t(`app.orders.${s}`)).join(', ')}>
            {STEPS.map((s, i) => {
              const on = i < step;
              return (
                <View key={s} style={styles.step}>
                  <View style={styles.stepTrack}>
                    <View style={[styles.stepLine, i === 0 && styles.hidden, on && styles.lineOn]} />
                    <View style={[styles.stepDot, on ? styles.dotOn : styles.dotOff]}>{on ? <Icon name="check" size={14} tint={color.white} strokeWidth={3} /> : null}</View>
                    <View style={[styles.stepLine, i === STEPS.length - 1 && styles.hidden, i + 1 < step && styles.lineOn]} />
                  </View>
                  <Text style={[type.small, { color: on ? color.ink : color.muted }]}>{t(`app.orders.${s}`)}</Text>
                </View>
              );
            })}
          </View>
          {order.paid_at ? (
            <View style={styles.protected}>
              <Icon name="shield" size={22} tint={color.gold} />
              <Text style={styles.protectedText}>{t('app.orders.paymentProtected')}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button label={t('app.orders.viewOrder')} onPress={open} dense style={{ flex: 0.85 }} />
            <Button
              label={order.role === 'buyer' ? t('app.orders.messageSeller') : t('app.orders.messageBuyer')}
              tone="outline"
              icon="message"
              onPress={() => router.push('/messages')}
              dense
              style={{ flex: 1.15 }}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  item: { flexDirection: 'row', gap: space.lg },
  thumb: { width: 112, height: 84, borderRadius: radius.md, backgroundColor: color.field },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  metaRule: { width: 1, height: 16, backgroundColor: color.border },
  method: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  stepLine: { flex: 1, height: 3, backgroundColor: color.border },
  lineOn: { backgroundColor: color.green },
  hidden: { opacity: 0 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: color.green },
  dotOff: { backgroundColor: color.white, borderWidth: 2, borderColor: color.faint },
  protected: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.sage, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  protectedText: { fontSize: 16, fontWeight: '700', color: color.forest },
  actions: { flexDirection: 'row', gap: space.md },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  details: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsText: { fontSize: 16, fontWeight: '600', color: color.green },
});
