import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, unwrap, useApi, useTaxonomy, type CheckoutQuote, type PublicListing } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, EmptyState, FieldLabel, FormError, IconButton, Input, ListLoading, SelectField, ui } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { openPayment } from '@/lib/payments';
import { color, gutter, radius, space, type } from '@/theme';

type Method = 'pickup' | 'delivery';

/**
 * Buy with protection (ORD-01, ORD-05, ORD-06): quantity, pickup or delivery (area and address),
 * the server's price check, the Buyer Terms, then Paystack in an in-app sheet. The order and the
 * payment each carry an Idempotency-Key made once per filled-in form, so a double tap or a retry
 * makes one order and one charge. Back from Paystack, the app asks the API whether it was paid.
 */
export default function CheckoutScreen() {
  const { t } = useTranslation(['orders', 'common', 'errors']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const taxonomy = useTaxonomy();
  const listing = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => unwrap(await api.GET('/v1/listings/{listing}', { params: { path: { listing: id } } })).data as PublicListing,
  });
  const options = ((listing.data?.fulfilment ?? []) as string[]).filter((m): m is Method => m === 'pickup' || m === 'delivery');
  const [quantity, setQuantity] = useState(1);
  const [picked, setPicked] = useState<Method | null>(null);
  const method: Method = picked ?? options[0] ?? 'pickup';
  const [areaId, setAreaId] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useRef<{ body: string; key: string } | null>(null);
  const working = useRef(false);

  const quote = useQuery({
    queryKey: orderKeys.quote(id, quantity, method),
    queryFn: async () => unwrap(await api.POST('/v1/checkout/quote', { body: { listing_id: id, quantity, fulfilment_method: method } })).data as unknown as CheckoutQuote,
    enabled: Boolean(listing.data),
    retry: false,
  });
  const q = quote.data;
  const quoteCode = quote.error instanceof ApiRequestError ? quote.error.code : quote.isError ? 'network_error' : null;
  const total = q ? formatNaira(q.total_kobo) : '';
  const maxQuantity = Math.min(99, q?.available_quantity ?? 99);

  const areas = (() => {
    const all = taxonomy.data?.locations ?? [];
    const lgas = all.filter((l) => l.type === 'lga').sort((a, b) => a.name.localeCompare(b.name));
    return lgas.flatMap((lga) => [
      { value: lga.id, label: lga.name },
      ...all.filter((l) => l.type === 'area' && l.parent_id === lga.id).sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: `${a.name}, ${lga.name}` })),
    ]);
  })();

  async function pay() {
    if (working.current || !q) return;
    const problems: Record<string, string> = {};
    if (method === 'delivery') {
      if (!areaId) problems['delivery.location_id'] = t('areaRequired');
      if (address.trim().length < 5) problems['delivery.address'] = t('addressRequired');
    }
    if (!accepted) problems.accept_terms = t('acceptRequired');
    setFields(problems);
    if (Object.keys(problems).length > 0) return;

    const body = {
      listing_id: id,
      quantity,
      fulfilment_method: method,
      ...(method === 'delivery' ? { delivery: { location_id: areaId!, address: address.trim(), note: note.trim() || null } } : {}),
      accept_terms: true as const,
    };
    // The same filled-in form keeps the same key, so a retry never makes a second order.
    const signature = JSON.stringify(body);
    if (intent.current?.body !== signature) intent.current = { body: signature, key: Crypto.randomUUID() };
    const key = intent.current.key;

    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const order = unwrap(await api.POST('/v1/orders', { body: { ...body, client_id: key } as never, headers: { 'Idempotency-Key': key } })).data;
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      const payment = unwrap(await api.POST('/v1/orders/{order}/pay', { params: { path: { order: order.id } }, body: {}, headers: { 'Idempotency-Key': `${key}-pay` } })).data;
      router.replace({ pathname: '/orders/[id]', params: { id: order.id } });
      if (payment.checkout_url) {
        await openPayment(payment.checkout_url, () => {
          void (async () => {
            try {
              const fresh = unwrap(await api.POST('/v1/orders/{order}/payment/check', { params: { path: { order: order.id } } })).data;
              queryClient.setQueryData(orderKeys.order(order.id), fresh);
            } finally {
              void queryClient.invalidateQueries({ queryKey: orderKeys.all });
            }
          })().catch(() => undefined);
        });
      }
    } catch (e) {
      const apiError = e instanceof ApiRequestError ? e : null;
      const serverFields = (apiError?.body as { fields?: Record<string, string[]> } | null)?.fields ?? {};
      setFields(Object.fromEntries(Object.entries(serverFields).map(([k, v]) => [k, v[0] ?? ''])));
      setError(t(errorKey(apiError?.code ?? 'network_error')));
      working.current = false;
      setBusy(false);
    }
  }

  const l = listing.data;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingVertical: space.xs }}>
        <IconButton icon="chevronLeft" label={t('backToItem')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
        <Text style={type.heading} accessibilityRole="header">{t('checkoutTitle')}</Text>
      </View>
      {listing.isPending ? (
        <ListLoading />
      ) : !l || quoteCode === 'checkout_unavailable' ? (
        <EmptyState icon="bag" title={quoteCode === 'checkout_unavailable' ? t('unavailable') : t('common:app.checkout.gone')} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[ui.card, styles.box]}>
              <Text style={type.heading}>{l.title}</Text>
              <Text style={type.small}>{t('soldBy', { name: l.seller.name })}</Text>
            </View>

            <FieldLabel>{t('quantity')}</FieldLabel>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common:app.checkout.less')} disabled={quantity <= 1 || busy} onPress={() => setQuantity((n) => Math.max(1, n - 1))} style={[styles.step, quantity <= 1 && { opacity: 0.4 }]}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.qty} accessibilityLabel={`${t('quantity')}: ${quantity}`}>{quantity}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common:app.checkout.more')} disabled={quantity >= maxQuantity || busy} onPress={() => setQuantity((n) => Math.min(maxQuantity, n + 1))} style={[styles.step, quantity >= maxQuantity && { opacity: 0.4 }]}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
              {q?.available_quantity != null ? <Text style={type.small}>{t('available', { count: q.available_quantity })}</Text> : null}
            </View>
            {quoteCode === 'not_enough_stock' ? <Text style={styles.error}>{t('errors:not_enough_stock')}</Text> : null}

            {options.length > 0 ? (
              <>
                <FieldLabel>{t('howYouGetIt')}</FieldLabel>
                {options.map((m) => {
                  const on = method === m;
                  return (
                    <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPicked(m)} style={[styles.option, on && styles.optionOn]}>
                      {on ? <Icon name="checkCircle" size={24} tint={color.green} /> : <View style={styles.radioOff} />}
                      <Icon name={m === 'delivery' ? 'truck' : 'shop'} size={24} tint={color.forest} />
                      <Text style={[type.bodyStrong, { flex: 1 }]}>{m === 'delivery' ? t('deliveryLabel') : t('pickupLabel')}</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            {method === 'delivery' ? (
              <>
                <FieldLabel>{t('deliveryArea')}</FieldLabel>
                <SelectField value={areaId} options={areas} onChange={setAreaId} placeholder={t('deliveryArea')} title={t('deliveryArea')} icon="pin" searchPlaceholder={t('deliveryArea')} error={fields['delivery.location_id']} />
                <FieldLabel>{t('deliveryAddress')}</FieldLabel>
                <Input value={address} onChangeText={setAddress} accessibilityLabel={t('deliveryAddress')} multiline maxLength={300} error={fields['delivery.address']} />
                <FieldLabel>{t('deliveryNote')}</FieldLabel>
                <Input value={note} onChangeText={setNote} accessibilityLabel={t('deliveryNote')} maxLength={300} error={fields['delivery.note']} />
              </>
            ) : null}

            <View style={[ui.card, styles.box]}>
              <Text style={type.heading}>{t('summary')}</Text>
              {quote.isPending ? (
                <ListLoading />
              ) : q ? (
                <View style={[{ gap: space.sm }, quote.isFetching && { opacity: 0.6 }]}>
                  <Row label={t('items', { count: q.quantity, price: formatNaira(q.unit_price_kobo) })} value={formatNaira(q.subtotal_kobo)} />
                  {q.fulfilment_method === 'delivery' ? <Row label={t('delivery')} value={q.delivery_fee_kobo ? formatNaira(q.delivery_fee_kobo) : t('noCharge')} /> : null}
                  {q.buyer_fee_kobo ? <Row label={t('serviceFee')} value={formatNaira(q.buyer_fee_kobo)} /> : null}
                  <View style={ui.divider} />
                  <Row label={t('total')} value={total} strong />
                </View>
              ) : quoteCode && quoteCode !== 'not_enough_stock' ? (
                <Text style={styles.error}>{t(errorKey(quoteCode))}</Text>
              ) : null}
            </View>

            <View style={[styles.box, styles.protect]}>
              <Text style={type.heading}>{t('protectionTitle')}</Text>
              {['protectionPay', 'protectionHold', 'protectionRelease', 'protectionOutside'].map((key) => (
                <View key={key} style={styles.point}>
                  <Icon name="shield" size={18} tint={color.gold} />
                  <Text style={[type.small, { flex: 1, color: color.ink }]}>{t(key)}</Text>
                </View>
              ))}
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/terms/[type]', params: { type: 'buyer' } })}>
                <Text style={styles.link}>{t('readTerms', { title: q?.terms.title ?? '' })}</Text>
              </Pressable>
            </View>

            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted, disabled: !q }} disabled={!q} onPress={() => setAccepted((v) => !v)} style={styles.tick}>
              {accepted ? <Icon name="checkCircle" size={24} tint={color.green} /> : <View style={styles.radioOff} />}
              <Text style={[type.body, { flex: 1 }]}>{t('acceptTerms', { total })}</Text>
            </Pressable>
            {fields.accept_terms ? <Text style={styles.error} accessibilityRole="alert">{fields.accept_terms}</Text> : null}

            <FormError message={error} />
            <Button label={busy ? t('opening') : t('pay', { total })} tone="gold" icon="shield" busy={busy} disabled={!q || quote.isFetching || busy} onPress={() => void pay()} />
            <Text style={[type.small, { textAlign: 'center' }]}>{t('payBy')}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Text style={[strong ? type.bodyStrong : type.body, { flex: 1 }]}>{label}</Text>
      <Text style={strong ? [type.price, { fontSize: 18 }] : type.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  box: { padding: space.lg, gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  step: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, fontWeight: '700', color: color.forest },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 20, fontWeight: '800', color: color.forest },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: color.field },
  optionOn: { backgroundColor: color.sage, borderWidth: 1.5, borderColor: color.green },
  radioOff: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color.faint },
  protect: { borderRadius: radius.lg, backgroundColor: color.sage },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  link: { fontSize: 15, fontWeight: '600', color: color.green, marginTop: space.xs },
  tick: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 48, paddingTop: space.xs },
  error: { color: color.danger, fontSize: 14 },
});
