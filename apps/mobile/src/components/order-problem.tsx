import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, unwrap, useApi, type DisputeCategory, type Order } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Button, Chip } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { color, radius, space, type } from '@/theme';

const categories: DisputeCategory[] = ['not_delivered', 'wrong_or_incomplete', 'quality', 'refund_disagreement', 'outside_payment', 'other'];

/** A buyer's report stops confirmation while WHY ME reviews the order. */
export function OrderProblem({ order }: { order: Order }) {
  const { t } = useTranslation(['orders', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const key = useRef<string | null>(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = formatNaira(order.total_kobo);

  if (order.dispute?.active) return null;
  if (!order.can_report_problem) return null;

  async function submit() {
    if (lock.current) return;
    const text = description.trim();
    const numeric = amount.trim() ? Number(amount.replace(/,/g, '')) : null;
    const kobo = numeric === null ? null : Math.round(numeric * 100);
    if (!category) return setError(t('orders:problem.categoryRequired'));
    if (text.length < 20) return setError(t('orders:problem.descriptionRequired'));
    if (kobo !== null && (!Number.isFinite(kobo) || kobo < 1 || kobo > order.total_kobo)) return setError(t('orders:problem.amountInvalid', { total }));
    lock.current = true;
    setBusy(true);
    setError(null);
    key.current ??= Crypto.randomUUID();
    try {
      const dispute = unwrap(await api.POST('/v1/orders/{order}/disputes', {
        params: { path: { order: order.id } },
        body: { category, description: text, amount_kobo: kobo },
        headers: { 'Idempotency-Key': key.current },
      })).data;
      queryClient.setQueryData(orderKeys.dispute(dispute.id), dispute);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      setOpen(false);
    } catch (cause) {
      setError(t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error')));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={type.heading}>{t('orders:problem.report')}</Text>
      <Text style={type.small}>{t('orders:problem.reportIntro')}</Text>
      {open ? (
        <View style={styles.form}>
          <Text style={type.label}>{t('orders:problem.title')}</Text>
          <View style={styles.categories}>{categories.map((value) => <Chip key={value} label={t(`orders:problem.category.${value}`)} selected={category === value} onPress={() => { setCategory(value); setError(null); }} />)}</View>
          <TextInput accessibilityLabel={t('orders:problem.description')} placeholder={t('orders:problem.description')} value={description} onChangeText={(value) => { setDescription(value); setError(null); }} multiline maxLength={2000} style={[styles.input, { minHeight: 110 }]} />
          <Text style={type.small}>{t('orders:problem.descriptionHint')}</Text>
          <TextInput accessibilityLabel={t('orders:problem.amount')} placeholder={t('orders:problem.amount')} value={amount} onChangeText={(value) => { setAmount(value); setError(null); }} keyboardType="decimal-pad" style={styles.input} />
          <Text style={type.small}>{t('orders:problem.amountHint', { total })}</Text>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label={t('orders:problem.send')} onPress={() => void submit()} busy={busy} />
          <Button label={t('orders:problem.cancel')} tone="quiet" onPress={() => setOpen(false)} disabled={busy} />
        </View>
      ) : <Button label={t('orders:problem.report')} tone="outline" onPress={() => setOpen(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: space.lg, gap: space.md, borderRadius: radius.xl, borderWidth: 1, borderColor: color.border, backgroundColor: color.white },
  form: { gap: space.md },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.md, backgroundColor: color.field, color: color.ink, fontSize: 16, textAlignVertical: 'top' },
  error: { color: color.danger, fontSize: 14 },
});
