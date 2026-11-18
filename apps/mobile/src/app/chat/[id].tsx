import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, chatKeys, ensureOk, isConnectionError, isRetryable, unwrap, useApi, type ChatMessage } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { EmptyState, IconButton, ListLoading } from '@/components/ui';
import { useConversation, useMessages } from '@/lib/chat';
import { formatNaira } from '@/lib/format';
import { color, gutter, radius, space, type } from '@/theme';

const MAX_LENGTH = 2000;

/** A message typed here and not yet confirmed by the server. */
type Pending = { clientId: string; body: string; state: 'sending' | 'failed' };

type Row = { kind: 'message'; message: ChatMessage } | { kind: 'pending'; pending: Pending };

/**
 * One chat. Newest at the bottom; scrolling up loads older messages. Sending keeps the same
 * client id on a retry, so a message that did reach the server is never stored twice. Messages
 * with phone numbers, bank details or links are refused, and the text is kept to change.
 */
export default function ChatScreen() {
  const { t, i18n } = useTranslation(['chat', 'common', 'errors']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(new Set<string>());
  const submitLock = useRef(false);

  const items = (messages.data?.pages ?? []).flatMap((page) => page.data);
  const confirmed = new Set(items.filter((m) => m.mine && m.client_id).map((m) => m.client_id));
  const waiting = pending.filter((p) => !confirmed.has(p.clientId));
  // Inverted list: index 0 is the newest, at the bottom.
  const rows: Row[] = [...waiting.slice().reverse().map((p) => ({ kind: 'pending' as const, pending: p })), ...items.map((m) => ({ kind: 'message' as const, message: m }))];
  const newestTheirs = items.find((m) => !m.mine)?.id;
  const c = conversation.data;
  const closed = Boolean(c?.closed);

  // Seeing the other side's newest message marks the chat read.
  useEffect(() => {
    if (!newestTheirs) return;
    void (async () => {
      ensureOk(await api.POST('/v1/conversations/{conversation}/read', { params: { path: { conversation: id } } }));
      void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
    })().catch(() => undefined);
  }, [api, id, newestTheirs, queryClient]);

  async function send(body: string, clientId: string = Crypto.randomUUID()) {
    if (sending.current.has(clientId)) return;
    sending.current.add(clientId);
    setError(null);
    setPending((list) => [...list.filter((p) => p.clientId !== clientId), { clientId, body, state: 'sending' }]);
    try {
      unwrap(await api.POST('/v1/conversations/{conversation}/messages', { params: { path: { conversation: id } }, body: { body, client_id: clientId } }));
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) });
      setPending((list) => list.filter((p) => p.clientId !== clientId));
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
    } catch (e) {
      if (e instanceof ApiRequestError && (e.status === 422 || e.code === 'conversation_closed')) {
        // Refused (a phone number in it, or the chat was closed): nothing was stored, so the text comes back.
        setPending((list) => list.filter((p) => p.clientId !== clientId));
        setDraft(body);
        setError(e.code === 'content_blocked' ? t('blocked') : t(errorKey(e.code)));
        if (e.code === 'conversation_closed') void queryClient.invalidateQueries({ queryKey: chatKeys.conversation(id) });
        return;
      }
      // No connection or a server hiccup: shown as "Not sent", and Try again reuses the same id.
      setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, state: 'failed' } : p)));
      if (!isConnectionError(e) && !isRetryable(e)) setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      sending.current.delete(clientId);
    }
  }

  function submit() {
    const body = draft.trim();
    if (!body || body.length > MAX_LENGTH || closed || !c || submitLock.current) return;
    submitLock.current = true;
    setDraft('');
    void send(body).finally(() => { submitLock.current = false; });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} size={44} bordered={false} />
        {c?.subject.thumb ? <Image source={{ uri: c.subject.thumb }} style={styles.headerThumb} contentFit="cover" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={type.heading} numberOfLines={1}>{c?.other_party.name ?? ' '}</Text>
          {c?.subject.title ? (
            <Text style={type.small} numberOfLines={1}>
              {c.subject.title}
              {c.subject.price_kobo ? ` · ${formatNaira(Number(c.subject.price_kobo))}` : ''}
              {c.subject.available === false ? ` · ${t('noLongerAvailable')}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          data={rows}
          inverted
          keyExtractor={(row) => (row.kind === 'message' ? row.message.id : row.pending.clientId)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (item.kind === 'message' ? <Bubble message={item.message} language={i18n.language} /> : <PendingBubble pending={item.pending} onRetry={() => void send(item.pending.body, item.pending.clientId)} />)}
          onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && void messages.fetchNextPage()}
          ListFooterComponent={
            <View style={{ gap: space.md }}>
              {messages.isFetchingNextPage ? <ActivityIndicator color={color.green} /> : null}
              <View style={styles.safety}>
                <Icon name="shield" size={20} tint={color.gold} />
                <Text style={[type.small, { flex: 1 }]}>{t('safety')}</Text>
              </View>
            </View>
          }
          ListEmptyComponent={messages.isPending ? <ListLoading /> : messages.isError ? <EmptyState icon="message" title={t('loadFailed')} /> : <EmptyState icon="message" title={t('startConversation')} />}
        />

        {!c ? null : closed ? (
          <View style={styles.closed} accessibilityRole="alert">
            <Text style={type.bodyStrong}>{t('closedNote', { reason: c?.closed_reason ?? '' })}</Text>
          </View>
        ) : (
          <View style={styles.composer}>
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <View style={styles.composerRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('writeMessage')}
                placeholderTextColor={color.faint}
                accessibilityLabel={t('writeMessage')}
                multiline
                maxLength={MAX_LENGTH}
                style={styles.input}
                onSubmitEditing={Platform.OS === 'web' ? submit : undefined}
                blurOnSubmit={false}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('send')}
                disabled={!draft.trim()}
                onPress={submit}
                style={({ pressed }) => [styles.send, !draft.trim() && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}>
                <Icon name="arrow" size={22} tint={color.white} strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function time(iso: string, language: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(language === 'ig' ? 'ig-NG' : 'en-NG', { hour: 'numeric', minute: '2-digit' });
}

function Bubble({ message, language }: { message: ChatMessage; language: string }) {
  const { t } = useTranslation('chat');
  const mine = message.mine;
  if (message.status === 'removed') {
    return (
      <View style={[styles.row, mine && styles.rowMine]}>
        <Text style={[type.small, styles.removed]}>{t('removedNote')}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, message.status !== 'sent' && styles.bubbleFlagged]}>
        <Text style={[type.body, mine && message.status === 'sent' && { color: color.white }]}>{message.body}</Text>
        <Text style={[styles.time, mine && message.status === 'sent' && { color: 'rgba(255,255,255,0.8)' }]}>{time(message.created_at, language)}</Text>
      </View>
      {message.status === 'held' ? <Text style={styles.note}>{t('heldNote')}</Text> : null}
      {message.status === 'rejected' ? <Text style={[styles.note, { color: color.danger }]}>{t('rejectedNote', { reason: message.rejection_reason ?? '' })}</Text> : null}
    </View>
  );
}

function PendingBubble({ pending, onRetry }: { pending: Pending; onRetry: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <View style={[styles.row, styles.rowMine]}>
      <View style={[styles.bubble, styles.bubbleMine, { opacity: pending.state === 'sending' ? 0.7 : 1 }]}>
        <Text style={[type.body, { color: color.white }]}>{pending.body}</Text>
        <Text style={[styles.time, { color: 'rgba(255,255,255,0.8)' }]}>{pending.state === 'sending' ? t('sending') : t('notSent')}</Text>
      </View>
      {pending.state === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
          <Text style={[styles.note, { color: color.green, fontWeight: '700' }]}>{t('tryAgain')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  headerThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: color.field },
  list: { paddingHorizontal: gutter, paddingVertical: space.lg, gap: space.sm },
  safety: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.sage, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  row: { alignItems: 'flex-start', gap: 2 },
  rowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm, gap: 2 },
  bubbleMine: { backgroundColor: color.green, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: color.field, borderBottomLeftRadius: 4 },
  bubbleFlagged: { backgroundColor: color.goldSoft },
  time: { fontSize: 11, color: color.muted, alignSelf: 'flex-end' },
  note: { fontSize: 12, color: color.muted, maxWidth: '82%' },
  removed: { fontStyle: 'italic', paddingVertical: space.xs },
  composer: { borderTopWidth: 1, borderTopColor: color.border, paddingHorizontal: gutter, paddingVertical: space.sm, gap: space.xs, backgroundColor: color.white },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1, borderColor: color.border, borderRadius: 23, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: color.ink, backgroundColor: color.field },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center' },
  error: { color: color.danger, fontSize: 14 },
  closed: { borderTopWidth: 1, borderTopColor: color.border, padding: gutter, backgroundColor: color.field },
});
