import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'primary' | 'accent' | 'warning';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface text-text-muted',
  primary: 'bg-primary-soft text-primary-pressed',
  accent: 'bg-accent-soft text-accent-text',
  warning: 'bg-accent-soft text-warning',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}
