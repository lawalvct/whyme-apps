import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, chatKeys, unwrap, useApi, type PublicListing, type PublicProfile } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { ListingCard } from '@/components/listing-card';
import { Button, EmptyState, FormError, IconButton, ListLoading, ui } from '@/components/ui';
import { mediaUrl } from '@/lib/api';
import { startConversation } from '@/lib/chat';
import { useSaveToggle } from '@/lib/saved';
import { useAccount } from '@/lib/session';
import { color, gutter, radius, space, type } from '@/theme';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * A shop's or service provider's page (DISC-10): name with the verified badge, trade and area,
 * about, opening hours or rates, and their live listings. "Send a message" opens a chat about the
 * page itself. Contact details never show: chat stays on WHY ME.
 */
export default function ProfileScreen() {
  const { t } = useTranslation(['common', 'market']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const save = useSaveToggle();
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => unwrap(await api.GET('/v1/profiles/{profile}', { params: { path: { profile: id } } })).data as PublicProfile,
  });
  const listings = useQuery({
    queryKey: ['profile', id, 'listings'],
    queryFn: async () => unwrap(await api.GET('/v1/profiles/{profile}/listings', { params: { path: { profile: id } } })).data as PublicListing[],
  });
  const p = profile.data;
  const photo = p?.logo?.medium ?? p?.photos[0]?.urls.medium;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={{ flexDirection: 'row', paddingHorizontal: space.sm, paddingVertical: space.xs }}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
      </View>
      {profile.isPending ? (
        <ListLoading />
      ) : !p ? (
        <EmptyState icon="shop" title={profile.error instanceof ApiRequestError && profile.error.status === 404 ? t('app.profile.gone') : t('app.loadFailed')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.head}>
            {photo ? <Image source={{ uri: mediaUrl(photo) }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, styles.noLogo]}><Icon name={p.kind === 'provider' ? 'tools' : 'shop'} size={34} tint={color.green} /></View>}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.row}>
                <Text style={[type.title, { flexShrink: 1 }]} accessibilityRole="header">{p.display_name}</Text>
                {p.verified ? <View accessibilityLabel={t('app.verified')}><Icon name="verified" size={22} tint={color.green} /></View> : null}
              </View>
              <Text style={type.small}>{[p.category?.name, p.location?.name].filter(Boolean).join(' · ')}</Text>
              {p.member_since ? <Text style={type.small}>{t('market:memberSince', { year: new Date(p.member_since).getFullYear() })}</Text> : null}
            </View>
          </View>

          {p.kind === 'provider' ? <RequestButton profileId={p.id} /> : null}
          <MessageButton profile={p} />

          {p.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {p.photos.map((ph) => (
                <Image key={ph.id} source={{ uri: mediaUrl(ph.urls.medium) }} style={styles.shot} contentFit="cover" />
              ))}
            </ScrollView>
          ) : null}

          {p.about ? (
            <View style={{ gap: space.sm }}>
              <Text style={type.heading}>{t('market:about')}</Text>
              <Text style={type.body}>{p.about}</Text>
            </View>
          ) : null}

          {p.years_experience || p.rate_note || p.availability_note ? (
            <View style={[ui.card, styles.box]}>
              {p.years_experience ? <Text style={type.body}>{t('app.profile.experience', { count: p.years_experience })}</Text> : null}
              {p.rate_note ? <Text style={type.body}>{t('app.profile.rates')}: {p.rate_note}</Text> : null}
              {p.availability_note ? <Text style={type.body}>{t('market:availability')}: {p.availability_note}</Text> : null}
            </View>
          ) : null}

          {p.opening_hours ? (
            <View style={[ui.card, styles.box]}>
              <Text style={type.heading}>{t('market:openingHours')}</Text>
              {DAYS.map((day) => {
                const slots = p.opening_hours?.[day] ?? [];
                return (
                  <View key={day} style={styles.hours}>
                    <Text style={type.body}>{t(`market:${day}`)}</Text>
                    <Text style={[type.body, !slots.length && { color: color.muted }]}>{slots.length ? slots.map((s) => `${s.open}–${s.close}`).join(', ') : t('market:closed')}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={type.title}>{t('app.profile.listings')}</Text>
          {listings.isPending ? (
            <ListLoading />
          ) : (listings.data ?? []).length === 0 ? (
            <Text style={type.small}>{t('app.profile.noListings')}</Text>
          ) : (
            <View style={styles.grid}>
              {(listings.data ?? []).map((l) => (
                <View key={l.id} style={styles.gridItem}>
                  <ListingCard listing={l} saved={save.isSaved(l.id)} onToggleSave={() => void save.toggle(l.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Providers take service requests: "Request a quote" (sign in and confirm the phone first). */
function RequestButton({ profileId }: { profileId: string }) {
  const { t } = useTranslation(['common']);
  const { status, user } = useAccount();
  return (
    <Button
      label={t('app.requests.requestQuote')}
      icon="tools"
      tone="gold"
      onPress={() => {
        if (status !== 'signed_in') return router.push('/sign-in');
        if (!user?.phone_verified_at) return router.push('/confirm-phone');
        router.push({ pathname: '/requests/new', params: { profile: profileId } });
      }}
    />
  );
}

function MessageButton({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation(['common', 'chat', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { status, user } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);

  async function open() {
    if (status !== 'signed_in') return router.push('/sign-in');
    if (!user?.phone_verified_at) return router.push('/confirm-phone');
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const conversation = await startConversation(api, { type: 'profile', id: profile.id });
      queryClient.setQueryData(chatKeys.conversation(conversation.id), conversation);
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
      router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
    } catch (e) {
      // Their own page: the server says so; show the friendly note.
      setError(e instanceof ApiRequestError && e.code === 'cannot_message_yourself' ? t('chat:yourOwn') : t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <Button label={t('app.profile.message')} icon="message" busy={busy} onPress={() => void open()} />
      <FormError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 84, height: 84, borderRadius: radius.lg, backgroundColor: color.field },
  noLogo: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.sage },
  shot: { width: 180, height: 130, borderRadius: radius.md, backgroundColor: color.field },
  box: { padding: space.lg, gap: space.sm },
  hours: { flexDirection: 'row', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  gridItem: { width: '47%', flexGrow: 1 },
});
