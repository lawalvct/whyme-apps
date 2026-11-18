import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOrders } from '@whyme/data';
import { AppHeader } from '@/components/app-header';
import { OrderCard } from '@/components/order-card';
import { SignedOut } from '@/components/signed-out';
import { Chip, EmptyState, ListLoading, Reassurance, Segmented } from '@/components/ui';
import { useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

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
        <Text style={type.display} accessibilityRole="header">{t('orders:orders')}</Text>
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
});
