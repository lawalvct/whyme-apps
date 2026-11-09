'use client';

import { useEffect, useState } from 'react';

/** Rotation stops while the visitor interacts, in background tabs, or with reduced motion. */
export function useRotatingContent(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);

  useEffect(() => {
    if (paused || interacting || count < 2) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setInterval(() => {
      if (!document.hidden && !motion.matches) setIndex((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [count, intervalMs, paused, interacting]);

  function select(next: number) {
    setIndex((next + count) % count);
    setPaused(true);
  }

  return { index, paused, select, setInteracting, togglePaused: () => setPaused((value) => !value) };
}
