import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUnreadNotifications } from '@whyme/data';
import { isSupportedLanguage } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { setLanguage } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { color, gutter, radius, space } from '@/theme';

/**
 * The header on every tab, as in the approved screens: the WHY ME logo, the language switch
 * (EN / IG), notifications with a gold dot for unread ones, and the account avatar.
 */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const { status, user } = useAccount();
  const unread = useUnreadNotifications(status === 'signed_in').data ?? 0;
  const next = i18n.language === 'ig' ? 'en' : 'ig';
  const languageName = i18n.language === 'ig' ? 'Igbo' : 'English';

  return (
    <View style={styles.row}>
      <Image source={require('@/assets/images/brand/whyme-logo-full.png')} style={styles.logo} contentFit="contain" accessibilityLabel="WHY ME" />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('app.language', { name: languageName })}
          onPress={() => isSupportedLanguage(next) && void setLanguage(next)}
          style={({ pressed }) => [styles.language, pressed && styles.pressed]}>
          <Text style={styles.languageText}>{i18n.language === 'ig' ? 'IG' : 'EN'}</Text>
          <Icon name="chevronDown" size={18} tint={color.forest} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${t('app.notifications')}, ${t('app.unread', { count: unread })}` : t('app.notifications')}
          onPress={() => router.push(status === 'signed_in' ? '/notifications' : '/sign-in')}
          hitSlop={6}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
          <Icon name="bell" size={28} tint={color.forest} />
          {unread > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status === 'signed_in' ? t('settings:account.menuLabel') : t('app.signIn')}
          onPress={() => router.push(status === 'signed_in' ? '/account' : '/sign-in')}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
          {user ? <Text style={styles.avatarText}>{user.first_name.slice(0, 1).toUpperCase()}</Text> : <Icon name="user" size={22} tint={color.green} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.md },
  logo: { width: 146, height: 35 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  language: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.field },
  languageText: { fontSize: 16, fontWeight: '700', color: color.forest },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 7, right: 8, width: 11, height: 11, borderRadius: 6, backgroundColor: color.gold, borderWidth: 2, borderColor: color.white },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.sageStrong, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700', color: color.green },
  pressed: { opacity: 0.75 },
});
