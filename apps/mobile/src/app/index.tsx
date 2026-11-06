import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { isSupportedLanguage, languages as bundledLanguages } from '@whyme/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@whyme/tokens';
import { SyncStatusChip } from '@/components/sync-status-chip';
import { useAppConfig } from '@/lib/config';
import { setLanguage } from '@/lib/i18n';

/** Phase 0 placeholder home: proves tokens, translations, server data and sync status. */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { data: config } = useAppConfig();

  // The server's list wins when known (also from the device copy); bundled list otherwise.
  const options = (
    config?.languages ??
    bundledLanguages.filter((l) => l.enabled).map((l) => ({ code: l.code, native_name: l.nativeName }))
  ).filter((l) => isSupportedLanguage(l.code));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>{t('appName')}</Text>
          <SyncStatusChip />
        </View>
        <Text style={styles.title}>{t('welcome')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>

        <Text style={styles.label}>{t('settings:language')}</Text>
        <View style={styles.row}>
          {options.map((l) => {
            const selected = i18n.language === l.code;
            return (
              <Pressable
                key={l.code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => isSupportedLanguage(l.code) && void setLanguage(l.code)}
                style={[styles.option, selected && styles.optionSelected]}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{l.native_name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>{t('sync:savedOffline')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.primary, fontSize: typography.size.sm, fontWeight: '700', letterSpacing: 2 },
  title: { color: colors.text, fontSize: typography.size.xxl, fontWeight: '700' },
  tagline: { color: colors.textMuted, fontSize: typography.size.md, marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: typography.size.sm, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { color: colors.text, fontSize: typography.size.md },
  optionTextSelected: { color: colors.primaryPressed, fontWeight: '600' },
  note: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.textMuted },
});
