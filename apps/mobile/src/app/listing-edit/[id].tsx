import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMyListing } from '@whyme/data';
import { ListingForm, type Kind } from '@/components/listing-form';
import { EmptyState, IconButton, ListLoading } from '@/components/ui';
import { color, space } from '@/theme';

/** Edit one of my listings (LST-05): the same form as Create listing, filled in. */
export default function EditListingScreen() {
  const { t } = useTranslation(['common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useMyListing(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/my-listings'));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', paddingHorizontal: space.sm, paddingTop: space.xs }}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={back} size={44} bordered={false} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {listing.isPending ? (
          <ListLoading />
        ) : !listing.data ? (
          <EmptyState icon="bag" title={t('app.loadFailed')} />
        ) : (
          <ListingForm key={listing.data.id} kind={listing.data.kind as Kind} onKind={() => undefined} canSell existing={listing.data} onDone={back} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
