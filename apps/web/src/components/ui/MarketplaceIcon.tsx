import type { SVGProps } from 'react';

const paths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  grid: <><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="3" y="15" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8.5 11.5 2.5 2.5 4.5-5" /></>,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  tools: <><path d="m14 6 4 4 4-4a7 7 0 0 1-9 9l-6 6a3 3 0 0 1-4-4l6-6a7 7 0 0 1 9-9l-4 4Z" /></>,
  shop: <><path d="M4 10v11h16V10M3 3h18l1 7a4 4 0 0 1-5 0 4 4 0 0 1-5 0 4 4 0 0 1-5 0 4 4 0 0 1-5 0l1-7Z" /><path d="M9 21v-7h6v7" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  sparkle: <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
  play: <path d="m8 4 12 8-12 8V4Z" fill="currentColor" stroke="none" />,
  facebook: <path d="M14 22v-9h3l.5-4H14V7c0-1.1.3-2 2-2h2V1.5C17.4 1.3 16.2 1 14.6 1 11.3 1 9 3 9 6.6V9H6v4h3v9h5Z" fill="currentColor" stroke="none" />,
  x: <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l8.2-9.4L.8 2h6.5l5.2 6.8L18.9 2ZM17.8 20h1.7L6.3 3.9H4.5L17.8 20Z" fill="currentColor" stroke="none" />,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M10 5h4M11 19h2" /></>,
  shirt: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z" />,
  home: <><path d="m3 10 9-8 9 8M5 8v13h14V8M9 21v-8h6v8" /><path d="M10 8h4" /></>,
  leaf: <><path d="M20 3C8 1 2 7 5 15s17 8 15-12Z" /><path d="M3 22 16 9M8 17v-6M8 17h6" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 10-13h-8l1-7Z" />,
  droplet: <><path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z" /><path d="M8 15a4 4 0 0 0 4 4" /></>,
  scissors: <><circle cx="5" cy="6" r="3" /><circle cx="5" cy="18" r="3" /><path d="m8 8 13 13M8 16 21 3M12 12l-4-4" /></>,
  car: <><path d="m5 7 2-4h10l2 4 2 3v8H3v-8l2-3ZM5 7h14M3 13h18M6 18v3M18 18v3M6 10h1M17 10h1" /></>,
  check: <path d="m5 12 4 4L19 6" />,
} as const;

export type MarketplaceIconName = keyof typeof paths;

export function MarketplaceIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: MarketplaceIconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
