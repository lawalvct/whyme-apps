import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { globalSyncStatus, useSyncStatus, type GlobalSyncStatus } from '@whyme/data';
import { colors, radius, spacing, typography } from '@whyme/tokens';

const PALETTE: Record<GlobalSyncStatus, { background: string; text: string }> = {
  online: { background: colors.primarySoft, text: colors.primaryPressed },
  syncing: { background: colors.accentSoft, text: colors.text },
  offline: { background: colors.surface, text: colors.textMuted },
  failed: { background: '#FDECEC', text: colors.danger },
};

/** Global Online / Offline / Syncing / Sync failed indicator (OFF07). */
export function SyncStatusChip() {
  const { t } = useTranslation('sync');
  const status = useSyncStatus(globalSyncStatus);
  const palette = PALETTE[status];

  return (
    <View accessibilityRole="text" style={[styles.chip, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{t(`global.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  label: { fontSize: typography.size.xs, fontWeight: '600' },
});
