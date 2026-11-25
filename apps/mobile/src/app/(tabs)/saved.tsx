import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/app-header';
import { ListingCard } from '@/components/listing-card';
import { SignedOut } from '@/components/signed-out';
import { EmptyState, ListLoading } from '@/components/ui';
import { useSaveToggle } from '@/lib/saved';
import { useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/** Saved listings, two to a row; tapping the bookmark again removes one. */
export default function SavedScreen() {
  const { t } = useTranslation();
  const { status } = useAccount();
  const save = useSaveToggle();
  const items = save.saved.data ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader />
      <FlatList
        data={status === 'signed_in' ? items : []}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={type.display} accessibilityRole="header">{t('app.savedTitle')}</Text>}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: '50%' }}>
            <ListingCard listing={item} saved onToggleSave={() => void save.toggle(item.id)} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} />
          </View>
        )}
        ListEmptyComponent={status !== 'signed_in' ? <SignedOut icon="bookmark" /> : save.saved.isPending ? <ListLoading /> : <EmptyState icon="bookmark" title={t('app.savedEmpty')} />}
        refreshControl={status === 'signed_in' ? <RefreshControl refreshing={save.saved.isRefetching} onRefresh={() => void save.saved.refetch()} tintColor={color.green} /> : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
});
