import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { color } from '@/theme';

/**
 * The WHY ME splash, shown first and held until the account is restored, then faded out, so the
 * app never flashes an empty or signed-out screen (mobile must feel native).
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() => setHidden(true));
  }, [opacity, ready]);

  if (hidden) return null;
  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents={ready ? 'none' : 'auto'} onLayout={() => void SplashScreen.hideAsync()}>
      <Image source={require('@/assets/images/brand/whyme-mark.png')} style={styles.mark} contentFit="contain" accessibilityLabel="WHY ME" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 112, height: 94 },
});
