import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, chatKeys, unwrap, useApi, useConfig, type PublicListing } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, EmptyState, FormError, IconButton, ListLoading, Pill, Reassurance, ui } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { startConversation } from '@/lib/chat';
import { formatNaira } from '@/lib/format';
import { useSaveToggle } from '@/lib/saved';
import { useAccount } from '@/lib/session';
import { color, gutter, radius, space, type } from '@/theme';

/**
 * A product or service (DISC-06): photos, price, area, seller, how you get it, the returns policy
 * WHY ME approved, and the actions. Products: Buy with protection (when checkout is switched on)
 * and Message seller. Services: Message provider (service requests come in a later app update).
 * Signed-out people sign in first; an unconfirmed phone confirms first; owners see a note.
 */
export default function ListingScreen() {
  const { t } = useTranslation(['common', 'market', 'orders', 'chat']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const save = useSaveToggle();
  const listing = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => unwrap(await api.GET('/v1/listings/{listing}', { params: { path: { listing: id } } })).data as PublicListing,
  });
  const l = listing.data;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.bar}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
        {l ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={save.isSaved(l.id) ? t('app.saved') : t('app.save')}
            accessibilityState={{ selected: save.isSaved(l.id) }}
            onPress={() => void save.toggle(l.id)}
            hitSlop={8}
            style={styles.saveButton}>
            <Icon name={save.isSaved(l.id) ? 'bookmarkFilled' : 'bookmark'} size={24} tint={save.isSaved(l.id) ? color.green : color.forest} />
          </Pressable>
        ) : null}
      </View>
      {listing.isPending ? (
        <ListLoading />
      ) : !l ? (
        <EmptyState icon="bag" title={listing.error instanceof ApiRequestError && listing.error.status === 404 ? t('app.listing.gone') : t('app.loadFailed')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Gallery listing={l} />
          <View style={{ gap: space.xs }}>
            {l.is_featured ? <Pill label={t('app.featured')} /> : null}
            <Text style={type.title} accessibilityRole="header">{l.title}</Text>
            <Text style={[type.price, { fontSize: 24 }]}>
              {l.price_kobo != null ? `${l.kind === 'service' ? `${t('market:searchPriceFrom', { price: '' }).trim()} ` : ''}${formatNaira(l.price_kobo)}` : t('market:priceOnRequest')}
            </Text>
            <View style={styles.meta}>
              <Icon name="pin" size={18} tint={color.muted} />
              <Text style={type.small}>{l.location.name}</Text>
              <Text style={type.small}>·</Text>
              <Text style={type.small}>{l.category.name}</Text>
            </View>
            {l.kind === 'product' && !l.in_stock ? <Pill label={t('market:outOfStock')} tone="red" /> : null}
          </View>

          <Seller listing={l} />
          <Actions listing={l} />
          <Reassurance title={t('app.protected')} />

          <Section title={l.kind === 'service' ? t('app.listing.aboutService') : t('app.listing.aboutItem')}>
            <Text style={type.body}>{l.description}</Text>
            {l.availability_note ? <Text style={type.small}>{t('market:availability')}: {l.availability_note}</Text> : null}
          </Section>

          {l.kind === 'product' && l.fulfilment.length > 0 ? (
            <Section title={t('orders:howYouGetIt')}>
              {(l.fulfilment as string[]).map((method) => (
                <View key={method} style={styles.meta}>
                  <Icon name={method === 'delivery' ? 'truck' : 'shop'} size={22} tint={color.green} />
                  <Text style={type.body}>{method === 'delivery' ? t('orders:deliveryLabel') : t('orders:pickupLabel')}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          <Section title={t('app.listing.returns')}>
            <Text style={type.body}>
              {l.refund_policy
                ? l.refund_policy.accepts_returns
                  ? t('app.listing.returnsYes', { count: l.refund_policy.return_days ?? 0 })
                  : t('app.listing.returnsNo')
                : t('app.listing.standard')}
            </Text>
            {l.refund_policy?.conditions ? <Text style={type.small}>{l.refund_policy.conditions}</Text> : null}
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Photos, swiped by hand, with "2 / 5". */
function Gallery({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const size = Math.min(width, 640) - gutter * 2;
  const [index, setIndex] = useState(0);
  const photos = listing.photos;

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / size);
    if (next !== index) setIndex(next);
  }

  if (photos.length === 0) {
    return (
      <View style={[styles.photo, styles.noPhoto, { width: size }]}>
        <Icon name="image" size={40} tint={color.faint} />
        <Text style={type.small}>{t('app.listing.noPhoto')}</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, alignSelf: 'center' }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32} style={styles.gallery}>
        {photos.map((photo, i) => (
          <Image
            key={photo.id}
            source={{ uri: mediaUrl(photo.urls.large) }}
            style={[styles.photo, { width: size }]}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('app.listing.photo', { current: i + 1, total: photos.length })}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>{index + 1} / {photos.length}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Seller({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation(['common']);
  const s = listing.seller;
  const open = s.profile_id ? () => router.push({ pathname: '/profile/[id]', params: { id: s.profile_id! } }) : undefined;
  return (
    <Pressable accessibilityRole={open ? 'link' : undefined} disabled={!open} onPress={open} style={[ui.card, styles.seller]}>
      <View style={styles.sellerIcon}>
        <Icon name={listing.kind === 'service' ? 'tools' : 'shop'} size={22} tint={color.green} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.small}>{listing.kind === 'service' ? t('app.listing.offeredBy') : t('app.listing.soldBy')}</Text>
        <View style={styles.meta}>
          <Text style={type.bodyStrong} numberOfLines={1}>{s.name}</Text>
          {s.verified ? <View accessibilityLabel={t('app.verified')}><Icon name="verified" size={18} tint={color.green} /></View> : null}
        </View>
      </View>
      {open ? <Text style={styles.link}>{t('app.viewProfile')}</Text> : null}
    </Pressable>
  );
}

/** Buy, message, or the note for the owner. One tap, one request (the chat opens once). */
function Actions({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation(['common', 'market', 'orders', 'chat', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { status, user } = useAccount();
  const checkoutOpen = useConfig().data?.features?.protected_checkout_enabled === true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const working = useRef(false);

  if (status === 'signed_in' && user?.id === listing.seller.id) {
    return <Text style={[type.small, styles.own]}>{t('chat:yourOwn')}</Text>;
  }

  /** Signed out: sign in. Unconfirmed phone: confirm it. Then the action. */
  function gate(action: () => void) {
    if (status !== 'signed_in') return router.push('/sign-in');
    if (!user?.phone_verified_at) return router.push('/confirm-phone');
    action();
  }

  async function message() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const conversation = await startConversation(api, { type: 'listing', id: listing.id });
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const product = listing.kind === 'product';
  const canBuy = product && listing.in_stock && listing.price_kobo != null;
  return (
    <View style={{ gap: space.sm }}>
      {product ? (
        <Button
          label={t('market:buyNow')}
          tone="gold"
          icon="shield"
          disabled={!canBuy}
          onPress={() => gate(() => (checkoutOpen ? router.push({ pathname: '/checkout/[id]', params: { id: listing.id } }) : setNote(t('orders:unavailable'))))}
        />
      ) : null}
      {!product ? <Button label={t('app.requests.requestQuote')} icon="tools" onPress={() => gate(() => router.push({ pathname: '/requests/new', params: { listing: listing.id } }))} /> : null}
      <Button label={product ? t('market:messageSeller') : t('app.listing.messageProvider')} tone="outline" icon="message" busy={busy} onPress={() => gate(() => void message())} />
      {note ? <Text style={type.small} accessibilityRole="alert">{note}</Text> : null}
      {status === 'signed_in' && !user?.phone_verified_at ? <Text style={type.small}>{t('app.listing.confirmFirst')}</Text> : null}
      <FormError message={error} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.heading} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm, paddingVertical: space.xs },
  saveButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  gallery: { borderRadius: radius.xl },
  photo: { aspectRatio: 1.15, backgroundColor: color.field, borderRadius: radius.xl },
  noPhoto: { alignItems: 'center', justifyContent: 'center', gap: space.sm, alignSelf: 'center' },
  counter: { position: 'absolute', right: space.md, bottom: space.md, backgroundColor: 'rgba(16,59,41,0.75)', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  counterText: { color: color.white, fontWeight: '700', fontSize: 13 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  seller: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  sellerIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: color.green },
  own: { padding: space.md, borderRadius: radius.md, backgroundColor: color.field },
});
