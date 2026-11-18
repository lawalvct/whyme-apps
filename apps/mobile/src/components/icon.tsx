import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '@/theme';

/**
 * Thin outline icons, drawn on a 24 × 24 grid like the website's MarketplaceIcon so the app and
 * site share one icon language. Decorative: the control around an icon carries its label.
 */
const shapes = {
  search: <><Circle cx="10.8" cy="10.8" r="6.8" /><Path d="m16 16 4.5 4.5" /></>,
  pin: <><Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><Circle cx="12" cy="10" r="2.5" /></>,
  chevronDown: <Path d="m7 10 5 5 5-5" />,
  chevronLeft: <Path d="m15 5-7 7 7 7" />,
  chevronRight: <Path d="m9 5 7 7-7 7" />,
  arrow: <Path d="M4 12h16m-6-6 6 6-6 6" />,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  shield: <><Path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><Path d="m8.5 11.5 2.5 2.5 4.5-5" /></>,
  bag: <><Path d="M5 8h14l1 13H4L5 8Z" /><Path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  tools: <><Path d="m14.5 6.5 3 3" /><Path d="M4 20 13 11" /><Path d="M16 3.5a4 4 0 0 1 4.5 4.5l-2 2-4.5-4.5 2-2Z" /><Path d="M4 4l4.5 1.5L11 8l-3 3-2.5-2.5L4 4Z" /><Path d="m14 14 6 6" /></>,
  shop: <><Path d="M4 10v11h16V10M3 3h18l1 7a4 4 0 0 1-5 0 4 4 0 0 1-5 0 4 4 0 0 1-5 0 4 4 0 0 1-5 0l1-7Z" /><Path d="M9 21v-7h6v7" /></>,
  briefcase: <><Rect x="3" y="7" width="18" height="13" rx="2" /><Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M11 12v2h2v-2" /></>,
  home: <><Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" /></>,
  homeFilled: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" fill="currentColor" />,
  bookmark: <Path d="M6 3h12v18l-6-4-6 4V3Z" />,
  bookmarkFilled: <Path d="M6 3h12v18l-6-4-6 4V3Z" fill="currentColor" />,
  box: <><Path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" /><Path d="m3 7 9 5 9-5M12 12v10" /></>,
  boxFilled: <><Path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" fill="currentColor" /><Path d="m3 7 9 5 9-5M12 12v10" stroke="#FFFFFF" /></>,
  message: <Path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z" />,
  messageFilled: <Path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z" fill="currentColor" />,
  bell: <><Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z" /><Path d="M10 21h4" /></>,
  sliders: <><Path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><Circle cx="16" cy="7" r="2" /><Circle cx="8" cy="17" r="2" /></>,
  truck: <><Path d="M2 6h12v10H2zM14 9h4l4 4v3h-8" /><Circle cx="6" cy="18" r="2" /><Circle cx="18" cy="18" r="2" /></>,
  check: <Path d="m5 12 5 5L20 7" />,
  checkCircle: <><Circle cx="12" cy="12" r="10" fill="currentColor" /><Path d="m7.5 12 3 3 6-6" stroke="#FFFFFF" /></>,
  camera: <><Path d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><Circle cx="12" cy="13" r="4" /></>,
  trash: <><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  image: <><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="9" cy="10" r="2" /><Path d="m21 16-5-5-9 9" /></>,
  globe: <><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></>,
  verified: <><Path d="m12 2 2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2L12 2Z" fill="currentColor" /><Path d="m8.5 12 2.5 2.5 4.5-5" stroke="#FFFFFF" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof shapes;

export function Icon({ name, size = 24, tint = color.ink, strokeWidth = 1.8 }: { name: IconName; size?: number; tint?: string; strokeWidth?: number }) {
  // The wrapper hides the drawing from screen readers on phones and the web alike.
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={tint} color={tint} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {shapes[name]}
      </Svg>
    </View>
  );
}
