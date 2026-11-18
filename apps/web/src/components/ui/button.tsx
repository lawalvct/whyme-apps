import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-pressed',
  secondary: 'border border-border bg-background text-text hover:border-primary hover:text-primary',
  ghost: 'text-primary hover:bg-primary-soft',
  // Gold fill with charcoal text: the gold itself is too light for text on white.
  accent: 'bg-accent text-text hover:brightness-95',
  // Only for actions that cannot be undone (deleting the account).
  danger: 'bg-danger text-white hover:brightness-90',
};

export function buttonClass(variant: Variant = 'primary', className?: string): string {
  return cn(base, variants[variant], className);
}

/** Large touch targets everywhere (UX03): 48px minimum height. */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = 'primary', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
