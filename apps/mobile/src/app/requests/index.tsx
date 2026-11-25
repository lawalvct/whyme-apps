import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useServiceRequests, type ServiceRequest } from '@whyme/data';
import { Icon } from '@/components/icon';
import { Chip, EmptyState, IconButton, ListLoading, Pill, Segmented, ui } from '@/components/ui';
import { SignedOut } from '@/components/signed-out';
import { formatDate, formatNaira } from '@/lib/format';
import { requestStatus } from '@/lib/requests';
import { useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

type Filter = 'all' | 'open' | 'done';
const FINISHED = ['completed', 'cancelled', 'declined', 'rejected'];

/** Service requests (REQ-01): the ones I sent (Requested) and the ones customers sent me (Received). */
export default function RequestsScreen() {
  const { t } = useTranslation(['requests', 'common']);
  const { status } = useAccount();
  // "?tab=received" opens the provider's side, as on the website.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [role, setRole] = useState<'customer' | 'provider'>(tab === 'received' ? 'provider' : 'customer');
  const [filter, setFilter] = useState<Filter>('all');
  const list = useServiceRequests(role);
  const items = (status === 'signed_in' ? (list.data ?? []) : []).filter((r) =>
    filter === 'all' ? true : filter === 'done' ? FINISHED.includes(r.status) : !FINISHED.includes(r.status),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
              <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
            </View>
            <Text style={type.display} accessibilityRole="header">{t('requestsTitle')}</Text>
            <Segmented
              options={[
                { value: 'customer', label: t('requested') },
                { value: 'provider', label: t('received') },
              ]}
              value={role}
              onChange={setRole}
            />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label={t('common:app.orders.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label={t('common:app.requests.open')} selected={filter === 'open'} onPress={() => setFilter('open')} />
              <Chip label={t('common:app.requests.done')} selected={filter === 'done'} onPress={() => setFilter('done')} />
            </View>
          </View>
        }
        renderItem={({ item }) => <Row request={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListEmptyComponent={
          status !== 'signed_in' ? (
            <SignedOut icon="tools" />
          ) : list.isPending ? (
            <ListLoading />
          ) : (
            <EmptyState
              icon="tools"
              title={list.isError ? t('loadFailed') : role === 'customer' ? t('emptyRequestedTitle') : t('emptyReceivedTitle')}
              body={list.isError ? undefined : role === 'customer' ? t('common:app.requests.emptyRequested') : t('emptyReceived')}
            />
          )
        }
        refreshControl={status === 'signed_in' ? <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={color.green} /> : undefined}
      />
    </SafeAreaView>
  );
}

function Row({ request }: { request: ServiceRequest }) {
  const { t, i18n } = useTranslation(['requests', 'common']);
  const s = requestStatus(request, t);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${request.title}, ${s.label}`} onPress={() => router.push({ pathname: '/requests/[id]', params: { id: request.id } })} style={[ui.card, styles.row]}>
      <View style={styles.top}>
        <Icon name="tools" size={20} tint={color.forest} />
        <Text style={[type.small, { flex: 1 }]}>{t('requestNumber', { number: request.number })}</Text>
        <Pill label={s.label} tone={s.tone} />
      </View>
      <Text style={type.heading} numberOfLines={2}>{request.title}</Text>
      <Text style={type.small}>
        {request.role === 'provider' ? t('customer') : t('provider')}: {request.other_party.name}
        {request.submitted_at ? ` · ${formatDate(request.submitted_at, i18n.language)}` : ''}
      </Text>
      {request.agreed_amount_kobo != null ? <Text style={[type.price, { fontSize: 17 }]}>{t('agreedAmount', { amount: formatNaira(request.agreed_amount_kobo) })}</Text> : request.latest_quote ? <Text style={type.bodyStrong}>{t('quotedAmount', { amount: formatNaira(request.latest_quote.amount_kobo) })}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { padding: space.lg, gap: space.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
