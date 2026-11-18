import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, orderKeys, unwrap, useApi, useDispute, type Order } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Button, ListLoading, Pill } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { color, radius, space, type } from '@/theme';

/** The buyer, seller and WHY ME can follow the same case from the order. */
export function OrderDispute({ order }: { order: Order }) {
  const { t, i18n } = useTranslation(['orders', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const query = useDispute(order.dispute?.id);
  const lock = useRef(false);
  const [body, setBody] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<'statement' | 'withdraw' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!order.dispute) return null;
  if (query.isPending) return <ListLoading />;
  if (!query.data) return <Text style={styles.error}>{t(errorKey(query.error instanceof ApiRequestError ? query.error.code : 'network_error'))}</Text>;

  const dispute = query.data;
  const total = formatNaira(order.total_kobo);

  async function addStatement() {
    if (lock.current || body.trim().length < 2) return;
    lock.current = true;
    setBusy('statement');
    setError(null);
    try {
      const fresh = unwrap(await api.POST('/v1/disputes/{dispute}/statements', { params: { path: { dispute: dispute.id } }, body: { body: body.trim() } })).data;
      queryClient.setQueryData(orderKeys.dispute(dispute.id), fresh);
      setBody('');
    } catch (cause) {
      setError(t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error')));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  async function withdraw() {
    if (lock.current) return;
    lock.current = true;
    setBusy('withdraw');
    setError(null);
    try {
      const fresh = unwrap(await api.POST('/v1/disputes/{dispute}/withdraw', { params: { path: { dispute: dispute.id } }, body: { version: dispute.version } })).data;
      queryClient.setQueryData(orderKeys.dispute(dispute.id), fresh);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      setAsking(false);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 409) void query.refetch();
      setError(t(errorKey(cause instanceof ApiRequestError ? cause.code : 'network_error')));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}><Text style={[type.heading, { flex: 1 }]}>{t('orders:problem.panelTitle')}</Text><Pill label={t(`orders:problem.state.${dispute.state}`)} tone={dispute.can_add_statement ? 'gold' : 'grey'} /></View>
      {dispute.can_add_statement ? <Text style={type.body}>{t(dispute.role === 'buyer' ? 'orders:problem.buyerActive' : 'orders:problem.sellerActive', { total })}</Text> : null}
      {dispute.evidence_due_at ? <Text style={type.small}>{t('orders:problem.evidenceDue', { date: new Date(dispute.evidence_due_at).toLocaleDateString(i18n.language === 'ig' ? 'ig-NG' : 'en-NG') })}</Text> : null}
      {dispute.outcome ? <View style={styles.card}><Text style={type.bodyStrong}>{dispute.outcome === 'withdrawn' ? t(dispute.role === 'buyer' ? 'orders:problem.withdrawn' : 'orders:problem.withdrawnSeller') : t(`orders:problem.outcome.${dispute.outcome}`, { refund: formatNaira(dispute.refund_kobo ?? 0) })}</Text>{dispute.resolution_note ? <Text style={type.small}>{t('orders:problem.reason', { reason: dispute.resolution_note })}</Text> : null}</View> : null}
      <View style={styles.card}><Text style={type.bodyStrong}>{t(`orders:problem.category.${dispute.category}`)}</Text><Text style={type.body}>{dispute.description}</Text></View>
      {dispute.statements.map((statement, index) => (
        <View key={`${statement.at}:${index}`} style={[styles.card, statement.mine && styles.mine]}>
          <Text style={type.small}>{t(statement.mine ? 'orders:problem.author.mine' : `orders:problem.author.${statement.author}`)} · {new Date(statement.at).toLocaleString(i18n.language === 'ig' ? 'ig-NG' : 'en-NG')}</Text>
          <Text style={type.body}>{statement.body}</Text>
        </View>
      ))}
      {dispute.can_add_statement ? (
        <View style={styles.form}>
          <Text style={type.label}>{t(dispute.role === 'buyer' ? 'orders:problem.add' : 'orders:problem.addSeller')}</Text>
          <TextInput accessibilityLabel={t('orders:problem.add')} placeholder={t('orders:problem.addHint')} value={body} onChangeText={setBody} multiline maxLength={2000} style={styles.input} />
          <Button label={t('orders:problem.addSend')} onPress={() => void addStatement()} busy={busy === 'statement'} disabled={Boolean(busy) || body.trim().length < 2} />
        </View>
      ) : null}
      {dispute.can_withdraw ? asking ? (
        <View style={styles.form}><Text style={type.body}>{t('orders:problem.withdrawQuestion')}</Text><Button label={t('orders:problem.withdrawYes')} tone="outline" onPress={() => void withdraw()} busy={busy === 'withdraw'} disabled={Boolean(busy)} /><Button label={t('orders:problem.keep')} tone="quiet" onPress={() => setAsking(false)} disabled={Boolean(busy)} /></View>
      ) : <Button label={t('orders:problem.withdraw')} tone="quiet" onPress={() => setAsking(true)} /> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.xl, borderWidth: 1, borderColor: color.sageBorder, backgroundColor: color.sage, padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { backgroundColor: color.white, borderRadius: radius.md, padding: space.md, gap: space.xs },
  mine: { alignSelf: 'flex-end', backgroundColor: color.sageStrong, maxWidth: '90%' },
  form: { gap: space.md },
  input: { minHeight: 88, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, backgroundColor: color.white, padding: space.md, fontSize: 16, color: color.ink, textAlignVertical: 'top' },
  error: { color: color.danger, fontSize: 14 },
});
