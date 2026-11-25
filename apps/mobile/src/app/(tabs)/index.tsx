import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { unwrap, useApi } from '@whyme/data';
import { AppHeader } from '@/components/app-header';
import { Icon, type IconName } from '@/components/icon';
import { ListingCard, ProviderRow } from '@/components/listing-card';
import { EmptyState, IconButton, Reassurance, SectionHeader } from '@/components/ui';
import { useSaveToggle } from '@/lib/saved';
import { color, gutter, radius, space, type } from '@/theme';

const SLIDES = [
  { id: 'local', title: 'market:heroHeadingLine1', accent: 'market:heroHeadingLine2', photo: require('@/assets/images/home/local.jpg'), search: {} },
  { id: 'igbo', title: 'market:igboHeroTitle', accent: 'market:igboHeroAccent', photo: require('@/assets/images/home/igbo.jpg'), search: { type: 'people', kind: 'business' } },
  { id: 'christmas', title: 'market:christmasHeroTitle', accent: 'market:christmasHeroAccent', photo: require('@/assets/images/home/christmas.jpg'), search: { q: 'Christmas' } },
] as const;

const SHORTCUTS: { icon: IconName; label: string; search: Record<string, string> }[] = [
  { icon: 'bag', label: 'market:products', search: { kind: 'product' } },
  { icon: 'tools', label: 'market:services', search: { kind: 'service' } },
  { icon: 'shop', label: 'market:businesses', search: { type: 'people', kind: 'business' } },
  { icon: 'briefcase', label: 'market:jobs', search: { type: 'jobs' } },
];

/** Home, as approved: header, area, search, the three-slide carousel, shortcuts, trust row, fresh finds and nearby providers. */
export default function HomeScreen() {
  const { t } = useTranslation(['common', 'market']);
  const api = useApi();
  const save = useSaveToggle();
  const listings = useQuery({
    queryKey: ['home', 'listings'],
    queryFn: async () => unwrap(await api.GET('/v1/listings', { params: { query: { kind: 'product' } } })).data,
  });
  const providers = useQuery({
    queryKey: ['home', 'providers'],
    queryFn: async () => unwrap(await api.GET('/v1/profiles', { params: { query: { kind: 'provider' } } })).data,
  });
  const fresh = (listings.data ?? []).slice(0, 4);
  const pros = (providers.data ?? []).slice(0, 3);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={listings.isRefetching} onRefresh={() => void Promise.all([listings.refetch(), providers.refetch()])} tintColor={color.green} />}>
        <View style={styles.location} accessibilityRole="text">
          <Icon name="pin" size={24} tint={color.green} />
          <Text style={styles.locationText}>{t('app.location')}</Text>
        </View>

        <View style={styles.searchRow}>
          <Pressable accessibilityRole="search" accessibilityLabel={t('app.searchPlaceholder')} onPress={() => router.push('/search')} style={styles.search}>
            <Icon name="search" size={24} tint={color.forest} />
            <Text style={styles.searchText} numberOfLines={1}>{t('app.searchPlaceholder')}</Text>
          </Pressable>
          <IconButton icon="sliders" label={t('app.filters')} onPress={() => router.push('/search')} />
        </View>

        <Carousel />

        <View style={styles.shortcuts}>
          {SHORTCUTS.map((s) => (
            <Pressable key={s.label} accessibilityRole="button" onPress={() => router.push({ pathname: '/search', params: s.search })} style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.75 }]}>
              <View style={styles.shortcutIcon}>
                <Icon name={s.icon} size={30} tint={color.green} />
              </View>
              <Text style={styles.shortcutLabel} numberOfLines={1}>{t(s.label)}</Text>
            </Pressable>
          ))}
        </View>

        <Reassurance title={t('app.protected')} />

        <SectionHeader title={t('app.freshFinds')} action={t('app.seeAll')} onAction={() => router.push({ pathname: '/search', params: { kind: 'product' } })} />
        {listings.isError && !listings.data ? (
          <EmptyState icon="image" title={t('app.loadFailed')} />
        ) : fresh.length === 0 && !listings.isPending ? (
          <EmptyState icon="bag" title={t('app.nothingYet')} />
        ) : (
          <View style={styles.grid}>
            {listings.isPending
              ? [0, 1].map((n) => <View key={n} style={styles.placeholder} />)
              : fresh.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <ListingCard listing={item} saved={save.isSaved(item.id)} onToggleSave={() => void save.toggle(item.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} />
                  </View>
                ))}
          </View>
        )}

        {pros.length > 0 ? (
          <>
            <SectionHeader title={t('app.skilledPeople')} action={t('app.seeAll')} onAction={() => router.push({ pathname: '/search', params: { type: 'people', kind: 'provider' } })} />
            <View style={{ gap: space.md }}>
              {pros.map((p) => (
                <ProviderRow key={p.id} profile={p} onPress={() => router.push({ pathname: '/profile/[id]', params: { id: p.id } })} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Three slides, swiped by hand; the dots and "01 / 03" sit inside the card. */
function Carousel() {
  const { t } = useTranslation(['common', 'market']);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 640) - gutter * 2;
  const [index, setIndex] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
    if (next !== index && next >= 0 && next < SLIDES.length) setIndex(next);
  }

  return (
    <View style={[styles.carousel, { width: cardWidth }]}>
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
        {SLIDES.map((slide, i) => (
          <View key={slide.id} style={[styles.slide, { width: cardWidth }]} accessibilityLabel={t('app.slide', { current: i + 1, total: SLIDES.length })}>
            <View style={styles.slidePhotoWrap}>
              <Image source={slide.photo} style={styles.slidePhoto} contentFit="cover" contentPosition="top" />
            </View>
            <View style={styles.slideText}>
              <Text style={styles.slideTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t(slide.title)}</Text>
              <Text style={styles.slideAccent} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t(slide.accent)}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/search', params: slide.search })} style={({ pressed }) => [styles.explore, pressed && { opacity: 0.85 }]}>
                <Text style={styles.exploreText}>{t('app.exploreNow')}</Text>
                <Icon name="arrow" size={18} tint={color.forest} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.slideFooter} pointerEvents="box-none">
        <Text style={styles.slideCount}>
          {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </Text>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.id}
              accessibilityRole="button"
              accessibilityLabel={t('app.slide', { current: i + 1, total: SLIDES.length })}
              hitSlop={8}
              onPress={() => {
                scroller.current?.scrollTo({ x: i * cardWidth, animated: true });
                setIndex(i);
              }}>
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  location: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  locationText: { fontSize: 18, fontWeight: '600', color: color.ink },
  searchRow: { flexDirection: 'row', gap: space.md },
  search: { flex: 1, height: 52, borderRadius: radius.lg, backgroundColor: color.field, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  searchText: { flex: 1, fontSize: 17, color: color.muted },
  carousel: { height: 168, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#0E4A2E', alignSelf: 'center' },
  slide: { height: 168, flexDirection: 'row' },
  slidePhotoWrap: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '44%', backgroundColor: color.gold, borderTopLeftRadius: 140, overflow: 'hidden' },
  slidePhoto: { width: '100%', height: '100%' },
  slideText: { width: '60%', paddingLeft: space.xl, paddingTop: space.lg },
  slideTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: color.white, letterSpacing: -0.3 },
  slideAccent: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: color.goldBright, letterSpacing: -0.3 },
  explore: { marginTop: space.sm, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.goldBright, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 36 },
  exploreText: { fontSize: 15, fontWeight: '700', color: color.forest },
  slideFooter: { position: 'absolute', left: space.xl, bottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xl },
  slideCount: { color: color.white, fontSize: 13, fontWeight: '600', opacity: 0.9 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: color.goldBright },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-between' },
  shortcut: { flex: 1, alignItems: 'center', gap: space.sm },
  shortcutIcon: { width: 58, height: 58, borderRadius: radius.lg, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { ...type.body, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  gridItem: { width: '47%', flexGrow: 1 },
  placeholder: { width: '47%', flexGrow: 1, height: 220, borderRadius: radius.lg, backgroundColor: color.field },
});
