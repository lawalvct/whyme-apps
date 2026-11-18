import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useUnreadMessages } from '@whyme/data';
import { Icon, type IconName } from '@/components/icon';
import { useAccount } from '@/lib/session';
import { color, space } from '@/theme';

/**
 * The five tabs of the approved design: Home, Saved, Sell (a green plus), Orders, Messages,
 * with the unread count on Messages. One custom bar on iPhone, Android and the web preview.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { status } = useAccount();
  const unread = useUnreadMessages(status === 'signed_in').data ?? 0;

  return (
    <Tabs style={{ flex: 1, backgroundColor: color.canvas }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="home" activeIcon="homeFilled" label={t('app.tabs.home')} />
          </TabTrigger>
          <TabTrigger name="saved" href="/saved" asChild>
            <TabButton icon="bookmark" activeIcon="bookmarkFilled" label={t('app.tabs.saved')} />
          </TabTrigger>
          <TabTrigger name="sell" href="/sell" asChild>
            <TabButton icon="plus" label={t('app.tabs.sell')} sell />
          </TabTrigger>
          <TabTrigger name="orders" href="/orders" asChild>
            <TabButton icon="box" activeIcon="boxFilled" label={t('app.tabs.orders')} />
          </TabTrigger>
          <TabTrigger name="messages" href="/messages" asChild>
            <TabButton icon="message" activeIcon="messageFilled" label={t('app.tabs.messages')} badge={unread} />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({ children, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  return (
    <View {...props} style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {children}
    </View>
  );
}

function TabButton({ icon, activeIcon, label, sell, badge = 0, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName; activeIcon?: IconName; label: string; sell?: boolean; badge?: number }) {
  const { t } = useTranslation();
  const tint = isFocused ? color.green : color.ink;
  return (
    <Pressable
      {...(props as PressableProps)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={badge > 0 ? `${label}, ${t('app.unread', { count: badge })}` : label}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}>
      <View>
        {sell ? (
          <View style={styles.sell}>
            <Icon name="plus" size={24} tint={color.white} strokeWidth={2.6} />
          </View>
        ) : (
          <Icon name={isFocused && activeIcon ? activeIcon : icon} size={28} tint={tint} />
        )}
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: tint }, isFocused && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: color.white, borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.sm },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 56 },
  sell: { width: 34, height: 32, borderRadius: 8, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  label: { fontSize: 13, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: color.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.white },
  badgeText: { fontSize: 11, fontWeight: '800', color: color.forest },
});
