import { cn } from './cn';

/** A grey placeholder shape while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-surface', className)} />;
}
