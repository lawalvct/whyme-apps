import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTerms } from '@whyme/data';
import { Button, EmptyState, IconButton, ListLoading } from '@/components/ui';
import { color, gutter, space, type } from '@/theme';

/** Read the current terms from the API without leaving the app. */
export default function TermsScreen() {
  const { type: requestedType } = useLocalSearchParams<{ type: string }>();
  const { t, i18n } = useTranslation(['common', 'auth']);
  const kind = requestedType === 'buyer' || requestedType === 'seller' || requestedType === 'privacy' ? requestedType : 'platform';
  const terms = useTerms(kind, i18n.language);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}><IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-up'))} size={44} bordered={false} /></View>
        {terms.isPending ? <ListLoading /> : !terms.data ? <EmptyState icon="shield" title={t('app.loadFailed')} action={<Button label={t('common:retry')} onPress={() => void terms.refetch()} />} /> : (
          <>
            <Text style={type.title} accessibilityRole="header">{terms.data.title}</Text>
            <Text style={type.small}>{terms.data.version}</Text>
            {terms.data.body.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
              const heading = block.match(/^#{1,4}\s+(.+)$/);
              return <Text key={index} style={heading ? type.heading : type.body}>{heading ? heading[1] : block.replace(/^[-*]\s/gm, '• ')}</Text>;
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  top: { paddingTop: space.sm },
});
