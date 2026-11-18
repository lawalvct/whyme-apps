import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { unwrap, useApi, type PublicListing, type PublicProfile } from '@whyme/data';
import { Icon } from '@/components/icon';
import { ListingCard, ProviderRow } from '@/components/listing-card';
import { Chip, EmptyState, ListLoading, IconButton, ui } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { useSaveToggle } from '@/lib/saved';
import { color, gutter, radius, space, type } from '@/theme';

type Scope = 'product' | 'service' | 'business' | 'provider' | 'jobs';

type Vacancy = { id: string; title: string; company_name: string | null; location: { name: string | null } | null; salary_min_kobo: number | null };

/** Search and browse: products, services, businesses, service providers or jobs, with or without words. */
export default function SearchScreen() {
  const { t } = useTranslation(['common', 'market', 'jobs']);
  const api = useApi();
  const save = useSaveToggle();
  const params = useLocalSearchParams<{ q?: string; kind?: string; type?: string }>();
  const initial: Scope = params.type === 'jobs' ? 'jobs' : params.type === 'people' ? (params.kind === 'provider' ? 'provider' : 'business') : params.kind === 'service' ? 'service' : 'product';
  const [scope, setScope] = useState<Scope>(initial);
  const [text, setText] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');

  // Search as the person types, after a short pause.
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);

  const results = useQuery({
    queryKey: ['search', scope, q],
    queryFn: async (): Promise<{ listings?: PublicListing[]; profiles?: PublicProfile[]; jobs?: Vacancy[] }> => {
      if (scope === 'jobs') return { jobs: unwrap(await api.GET('/v1/jobs', { params: { query: q ? { q } : {} } })).data as unknown as Vacancy[] };
      if (scope === 'business' || scope === 'provider') {
        const profiles = q
          ? unwrap(await api.GET('/v1/search/profiles', { params: { query: { q, kind: scope } } })).data
          : unwrap(await api.GET('/v1/profiles', { params: { query: { kind: scope } } })).data;
        return { profiles };
      }
      const listings = q
        ? unwrap(await api.GET('/v1/search/listings', { params: { query: { q, kind: scope } } })).data
        : unwrap(await api.GET('/v1/listings', { params: { query: { kind: scope } } })).data;
      return { listings };
    },
  });

  const count = (results.data?.listings ?? results.data?.profiles ?? results.data?.jobs ?? []).length;
  const scopes: { value: Scope; label: string }[] = [
    { value: 'product', label: t('market:products') },
    { value: 'service', label: t('market:services') },
    { value: 'business', label: t('market:businesses') },
    { value: 'provider', label: t('market:providers') },
    { value: 'jobs', label: t('market:jobs') },
  ];

  const header = (
    <View style={{ gap: space.md }}>
      <View style={styles.top}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
        <View style={styles.search}>
          <Icon name="search" size={22} tint={color.forest} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('app.searchPlaceholder')}
            placeholderTextColor={color.muted}
            style={styles.input}
            autoFocus={!params.kind && !params.type && !params.q}
            returnKeyType="search"
            onSubmitEditing={() => setQ(text.trim())}
            accessibilityLabel={t('app.search.title')}
          />
        </View>
      </View>
      <FlatList horizontal data={scopes} keyExtractor={(s) => s.value} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} renderItem={({ item }) => <Chip label={item.label} selected={scope === item.value} onPress={() => setScope(item.value)} />} />
      {results.data ? <Text style={type.small}>{t('app.search.results', { count })}</Text> : null}
    </View>
  );

  const empty = results.isPending ? <ListLoading /> : <EmptyState icon="search" title={results.isError ? t('app.loadFailed') : t('app.search.noResults')} />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {results.data?.listings || (results.isPending && (scope === 'product' || scope === 'service')) ? (
        <FlatList
          data={results.data?.listings ?? []}
          keyExtractor={(l) => l.id}
          numColumns={2}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: '50%' }}>
              <ListingCard listing={item} saved={save.isSaved(item.id)} onToggleSave={() => void save.toggle(item.id)} />
            </View>
          )}
        />
      ) : results.data?.jobs ? (
        <FlatList
          data={results.data.jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <View style={[ui.card, { padding: space.lg, gap: 4 }]}>
              <Text style={type.heading}>{item.title}</Text>
              <Text style={type.small}>{[item.company_name, item.location?.name].filter(Boolean).join(' · ')}</Text>
              {item.salary_min_kobo ? <Text style={[type.price, { fontSize: 17 }]}>{formatNaira(item.salary_min_kobo)}</Text> : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={results.data?.profiles ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          renderItem={({ item }) => <ProviderRow profile={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  search: { flex: 1, height: 50, borderRadius: radius.lg, backgroundColor: color.field, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  input: { flex: 1, fontSize: 17, color: color.ink, height: 48 },
});
