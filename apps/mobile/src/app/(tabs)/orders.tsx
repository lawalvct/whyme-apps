import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOrders } from '@whyme/data';
import { AppHeader } from '@/components/app-header';
import { Icon } from '@/components/icon';
import { OrderCard } from '@/components/order-card';
import { SignedOut } from '@/components/signed-out';
import { Chip, EmptyState, ListLoading, Reassurance, Segmented } from '@/components/ui';
import { useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/** The requests list (requests/index.tsx); the generated route types only know it as /requests/index. */
const REQUESTS = '/requests' as Href;

type Filter = 'all' | 'open' | 'done';

/** Orders, as approved: Bought / Sold, All / In progress / Completed, then each order's progress. */
export default function OrdersScreen() {
  const { t } = useTranslation(['common', 'orders']);
  const { status } = useAccount();
  const [role, setRole] = useState<'buying' | 'selling'>('buying');
  const [filter, setFilter] = useState<Filter>('all');
  const orders = useOrders(role, status === 'signed_in');
  const all = status === 'signed_in' ? (orders.data ?? []) : [];
  const shown = all.filter((o) =>
    filter === 'all' ? true : filter === 'done' ? o.fulfilment_state === 'completed' : !['completed', 'cancelled'].includes(o.fulfilment_state),
  );

  const header = (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text style={[type.display, { flex: 1 }]} accessibilityRole="header">{t('orders:orders')}</Text>
          <Pressable accessibilityRole="link" accessibilityLabel={t('app.requests.linkTitle')} onPress={() => router.push(REQUESTS)} hitSlop={8} style={styles.requestsLink}>
            <Icon name="tools" size={18} tint={color.green} />
            <Text style={styles.requestsText}>{t('app.requests.linkTitle')}</Text>
          </Pressable>
        </View>
        <Text style={[type.body, { color: color.muted, fontSize: 18 }]}>{t('app.orders.subtitle')}</Text>
      </View>
      <Segmented
        options={[
          { value: 'buying', label: t('orders:bought') },
          { value: 'selling', label: t('orders:sold') },
        ]}
        value={role}
        onChange={setRole}
      />
      <View style={styles.chips}>
        <Chip label={t('app.orders.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={t('app.orders.inProgress')} selected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label={t('app.orders.completed')} selected={filter === 'done'} onPress={() => setFilter('done')} />
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader />
      {status !== 'signed_in' ? (
        <View style={styles.content}>
          {header}
          <SignedOut icon="box" />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          renderItem={({ item }) => <OrderCard order={item} />}
          ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
          ListEmptyComponent={
            orders.isPending ? <ListLoading /> : (
              <EmptyState icon="box" title={orders.isError ? t('app.loadFailed') : role === 'buying' ? t('app.orders.emptyBought') : t('app.orders.emptySold')} />
            )
          }
          ListFooterComponent={<Reassurance large title={t('app.orders.peaceTitle')} body={t('app.orders.peaceBody')} />}
          refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={color.green} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  requestsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  requestsText: { fontSize: 15, fontWeight: '600', color: color.green },
});
