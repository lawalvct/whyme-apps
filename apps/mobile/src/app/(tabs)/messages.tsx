import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Conversation } from '@whyme/data';
import { AppHeader } from '@/components/app-header';
import { Icon } from '@/components/icon';
import { SignedOut } from '@/components/signed-out';
import { EmptyState, ListLoading, ui } from '@/components/ui';
import { useAccount } from '@/lib/session';
import { useInbox } from '@/lib/chat';
import { color, gutter, radius, space, type } from '@/theme';

/** Chats with sellers, buyers and employers. */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const { status } = useAccount();
  const inbox = useInbox(true);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader />
      <FlatList
        data={status === 'signed_in' ? (inbox.data ?? []) : []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 2 }}>
            <Text style={type.display} accessibilityRole="header">{t('app.messages.title')}</Text>
          </View>
        }
        renderItem={({ item }) => <Row conversation={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListEmptyComponent={status !== 'signed_in' ? <SignedOut icon="message" /> : inbox.isPending ? <ListLoading /> : <EmptyState icon="message" title={inbox.isError ? t('app.loadFailed') : t('app.messages.empty')} />}
        refreshControl={status === 'signed_in' ? <RefreshControl refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} tintColor={color.green} /> : undefined}
      />
    </SafeAreaView>
  );
}

function Row({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation();
  const last = conversation.last_message;
  const thumb = 'thumb' in conversation.subject ? conversation.subject.thumb : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${conversation.other_party.name}, ${conversation.subject.title}`} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })} style={[ui.card, styles.row]}>
      {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.noThumb]}><Icon name="message" size={24} tint={color.green} /></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={1}>{conversation.other_party.name}</Text>
          {conversation.unread_count > 0 ? (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{conversation.unread_count}</Text>
            </View>
          ) : null}
        </View>
        {conversation.subject.title ? <Text style={[type.small, { color: color.forest }]} numberOfLines={1}>{conversation.subject.title}</Text> : null}
        {last?.body ? (
          <Text style={[type.small, conversation.unread_count > 0 && { color: color.ink, fontWeight: '600' }]} numberOfLines={1}>
            {last.mine ? t('app.messages.you') : ''}
            {last.body}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: color.field },
  noThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.sage },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: color.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { fontSize: 12, fontWeight: '800', color: color.forest },
});
