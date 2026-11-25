import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, ensureOk, sellerKeys, unwrap, useApi, type ListingStatus, type OwnerListing } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, Chip, EmptyState, FormError, IconButton, ListLoading, Pill, ui } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { formatNaira } from '@/lib/format';
import { color, gutter, radius, space, type } from '@/theme';

type Filter = 'all' | 'published' | 'draft' | 'pending_review' | 'paused' | 'rejected';
const FILTERS: Filter[] = ['all', 'published', 'draft', 'pending_review', 'paused', 'rejected'];

/**
 * My listings (LST-05, LST-07): every product and service, by status, with Edit, Pause or
 * Resume, and Delete. Each action sends the version on screen; a change made elsewhere comes back
 * as a conflict and the list reloads. Deleting asks first.
 */
export default function MyListingsScreen() {
  const { t } = useTranslation(['seller', 'common']);
  const api = useApi();
  const [filter, setFilter] = useState<Filter>('all');
  const list = useQuery({
    queryKey: sellerKeys.listings({ status: filter }),
    queryFn: async () => unwrap(await api.GET('/v1/me/listings', { params: { query: filter === 'all' ? {} : { status: filter as ListingStatus } } })).data as unknown as OwnerListing[],
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
              <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/sell'))} size={44} bordered={false} />
            </View>
            <Text style={type.display} accessibilityRole="header">{t('navListings')}</Text>
            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(f) => f}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
              renderItem={({ item }) => <Chip label={item === 'all' ? t('all') : t(`status.${item}`)} selected={filter === item} onPress={() => setFilter(item)} />}
            />
          </View>
        }
        renderItem={({ item }) => <Row listing={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListEmptyComponent={
          list.isPending ? (
            <ListLoading />
          ) : (
            <EmptyState
              icon="bag"
              title={list.isError ? t('common:app.loadFailed') : filter === 'all' ? t('noListings') : t('noListingsFiltered')}
              action={filter === 'all' && !list.isError ? <Button label={t('addProduct')} onPress={() => router.push('/sell')} style={{ alignSelf: 'stretch', marginTop: space.sm }} /> : undefined}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={color.green} />}
      />
    </SafeAreaView>
  );
}

function Row({ listing }: { listing: OwnerListing }) {
  const { t } = useTranslation(['seller', 'common', 'errors', 'market']);
  const api = useApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'pause' | 'resume' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const photo = listing.photos[0]?.urls.thumb ?? listing.photos[0]?.urls.medium;
  const status = listing.status as ListingStatus;
  const tone = status === 'published' ? 'green' : status === 'rejected' || status === 'hidden' ? 'red' : status === 'paused' || status === 'draft' ? 'grey' : 'gold';

  async function act(kind: 'pause' | 'resume' | 'delete') {
    if (working.current) return;
    working.current = true;
    setBusy(kind);
    setError(null);
    try {
      const path = { params: { path: { listing: listing.id } } };
      if (kind === 'delete') ensureOk(await api.DELETE('/v1/me/listings/{listing}', path));
      else if (kind === 'pause') unwrap(await api.POST('/v1/me/listings/{listing}/pause', { ...path, body: { version: listing.version } }));
      else unwrap(await api.POST('/v1/me/listings/{listing}/resume', { ...path, body: { version: listing.version } }));
      await queryClient.invalidateQueries({ queryKey: sellerKeys.all });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 409) void queryClient.invalidateQueries({ queryKey: sellerKeys.all });
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  function confirmDelete() {
    const question = t('deleteConfirm', { title: listing.title });
    if (Platform.OS === 'web') {
      if (window.confirm(question)) void act('delete');
      return;
    }
    Alert.alert(question, undefined, [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => void act('delete') },
    ]);
  }

  return (
    <View style={[ui.card, styles.row]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('edit')}: ${listing.title}`} onPress={() => router.push({ pathname: '/listing-edit/[id]', params: { id: listing.id } })} style={styles.main}>
        {photo ? <Image source={{ uri: mediaUrl(photo) }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.noThumb]}><Icon name="image" size={24} tint={color.faint} /></View>}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.bodyStrong} numberOfLines={2}>{listing.title}</Text>
          <Text style={[type.price, { fontSize: 16 }]}>{listing.price_kobo != null ? formatNaira(listing.price_kobo) : t('market:priceOnRequest')}</Text>
          <Pill label={t(`status.${status}`)} tone={tone} />
        </View>
      </Pressable>
      {listing.status_reason && (status === 'rejected' || status === 'hidden') ? <Text style={[type.small, { color: color.danger }]}>{listing.status_reason}</Text> : null}
      <View style={styles.actions}>
        <Button label={t('edit')} tone="outline" compact onPress={() => router.push({ pathname: '/listing-edit/[id]', params: { id: listing.id } })} disabled={busy !== null} />
        {status === 'published' ? <Button label={t('pause')} tone="outline" compact busy={busy === 'pause'} disabled={busy !== null} onPress={() => void act('pause')} /> : null}
        {status === 'paused' ? <Button label={t('resume')} compact busy={busy === 'resume'} disabled={busy !== null} onPress={() => void act('resume')} /> : null}
        <Button label={t('delete')} tone="quiet" compact busy={busy === 'delete'} disabled={busy !== null} onPress={confirmDelete} />
      </View>
      <FormError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { padding: space.md, gap: space.sm },
  main: { flexDirection: 'row', gap: space.md },
  thumb: { width: 84, height: 72, borderRadius: radius.md, backgroundColor: color.field },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
