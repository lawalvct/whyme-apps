import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, unwrap, useApi, useTerms } from '@whyme/data';
import { Button, FormError, ListLoading } from '@/components/ui';
import { updateMe, useAccount } from '@/lib/session';
import { color, gutter, radius, space, type } from '@/theme';

/**
 * Asks a signed-in person to accept the Platform Terms when a new version is published, or when
 * the account never accepted (ACC-12). Shows the text in full; "I agree" records the version they
 * read, and the server refuses if a newer one appeared meanwhile. "Not now" hides it until the app
 * is opened again: buying and selling keep their own acceptance steps.
 */
export function TermsGate() {
  const { user } = useAccount();
  const [later, setLater] = useState(false);
  const pending = Boolean(user?.pending_terms?.includes('platform'));
  if (!pending || later) return null;
  return <TermsSheet onLater={() => setLater(true)} />;
}

function TermsSheet({ onLater }: { onLater: () => void }) {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const api = useApi();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const terms = useTerms('platform', i18n.language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);

  async function agree() {
    if (working.current || !terms.data) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      updateMe(queryClient, unwrap(await api.POST('/v1/me/terms/accept', { body: { type: 'platform', version: terms.data.version } })).data);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'terms_changed') {
        setError(t('termsChanged'));
        await terms.refetch();
      } else {
        setError(t('termsSaveFailed'));
      }
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onLater}>
      <View style={styles.frame}>
        {/* A fixed share of the screen, as in SelectField: a percentage height doesn't resolve in every renderer. */}
        <View style={[styles.sheet, { maxHeight: Math.round(height * 0.9), paddingBottom: insets.bottom + space.lg }]}>
          <Text style={type.title} accessibilityRole="header">{t('termsUpdatedTitle')}</Text>
          <Text style={type.small}>{t('termsUpdatedBody')}</Text>
          {terms.isPending ? (
            <ListLoading />
          ) : terms.data ? (
            <ScrollView style={styles.text} contentContainerStyle={{ padding: space.md }}>
              <Text style={type.heading}>{terms.data.title}</Text>
              <Text style={[type.small, { marginBottom: space.sm }]}>{terms.data.version}</Text>
              <Text style={type.body}>{terms.data.body}</Text>
            </ScrollView>
          ) : (
            <FormError message={t('termsSaveFailed')} />
          )}
          <FormError message={error} />
          <Button label={t('termsAgree')} busy={busy} disabled={!terms.data} onPress={() => void agree()} />
          <Button label={t('termsLater')} tone="quiet" disabled={busy} onPress={onLater} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.overlay },
  sheet: { backgroundColor: color.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: gutter, gap: space.md },
  // Shrinks on short phones so "I agree" and "Not now" always stay on screen.
  text: { flexGrow: 0, flexShrink: 1, maxHeight: 420, borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
});
