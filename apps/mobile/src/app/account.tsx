import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@whyme/data';
import { isSupportedLanguage } from '@whyme/i18n';
import { Button, Chip, IconButton, ui } from '@/components/ui';
import { setLanguage } from '@/lib/i18n';
import { signOut, useAccount } from '@/lib/session';
import { color, gutter, space, type } from '@/theme';

/** The signed-in account: who it is, language, and sign out. More settings stay on the website for now. */
export default function AccountScreen() {
  const { t, i18n } = useTranslation(['common', 'settings', 'auth']);
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAccount();
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  async function leave() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    await signOut(api, queryClient);
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
        </View>
        <Text style={type.display} accessibilityRole="header">{t('settings:account.title')}</Text>
        {user ? (
          <View style={[ui.card, { padding: space.lg, gap: space.sm }]}>
            <Text style={type.heading}>{user.first_name} {user.last_name}</Text>
            <Text style={type.small}>{user.phone}</Text>
            {user.email ? <Text style={type.small}>{user.email}</Text> : null}
          </View>
        ) : null}
        <Text style={type.label}>{t('settings:language')}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {(['en', 'ig'] as const).map((code) => (
            <Chip key={code} label={code === 'en' ? 'English' : 'Igbo'} selected={i18n.language === code} onPress={() => isSupportedLanguage(code) && void setLanguage(code)} />
          ))}
        </View>
        <Button label={t('auth:signOut')} tone="outline" busy={busy} onPress={() => void leave()} style={{ marginTop: space.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 520, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', paddingTop: space.sm },
});
