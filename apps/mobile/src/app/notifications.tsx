import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { markAllNotificationsRead, notificationKeys, useApi, useNotifications } from '@whyme/data';
import { EmptyState, ListLoading, IconButton, ui } from '@/components/ui';
import { useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/** The account's notifications, newest first; opening the list marks them read. */
export default function NotificationsScreen() {
  const { t } = useTranslation(['common', 'notifications']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { status } = useAccount();
  const list = useNotifications(status === 'signed_in');
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const hasUnread = items.some((n) => !n.read_at);

  useEffect(() => {
    if (!hasUnread) return;
    void markAllNotificationsRead(api).then(() => queryClient.invalidateQueries({ queryKey: notificationKeys.unread }));
  }, [api, hasUnread, queryClient]);

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
              <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
            </View>
            <Text style={type.display} accessibilityRole="header">{t('app.notifications')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[ui.card, styles.row, !item.read_at && styles.unread]}>
            <Text style={type.bodyStrong}>{item.title}</Text>
            {item.body ? <Text style={type.small}>{item.body}</Text> : null}
          </View>
        )}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        ListEmptyComponent={list.isPending ? <ListLoading /> : <EmptyState icon="bell" title={list.isError ? t('app.loadFailed') : t('notifications:empty')} />}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={color.green} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { padding: space.lg, gap: 4 },
  unread: { borderColor: color.green, backgroundColor: color.sage },
});
