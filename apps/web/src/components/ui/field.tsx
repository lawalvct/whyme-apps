import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

/** A labelled input with hint and error text wired up for screen readers. */
export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-12 rounded-lg border border-border bg-background px-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-primary-soft aria-invalid:border-danger"
        {...props}
      />
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
