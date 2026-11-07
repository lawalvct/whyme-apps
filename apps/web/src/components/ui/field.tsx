import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
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

const controlClass =
  'rounded-lg border border-border bg-background px-3 text-base text-text placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-primary-soft aria-invalid:border-danger';

function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextAreaField(
  { label, hint, error, className, id, rows = 5, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(controlClass, 'py-2.5 leading-relaxed')}
        {...props}
      />
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hint, error, className, id, children, ...props },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(controlClass, 'min-h-12')}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

/** A checkbox with its label as the tap target (48px tall row). */
export const CheckboxField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(
  function CheckboxField({ label, className, id, ...props }, ref) {
    const generated = useId();
    const fieldId = id ?? generated;
    return (
      <label htmlFor={fieldId} className={cn('flex min-h-12 cursor-pointer items-center gap-3 text-base', className)}>
        <input ref={ref} id={fieldId} type="checkbox" className="size-5 shrink-0 accent-primary" {...props} />
        <span>{label}</span>
      </label>
    );
  },
);

/** Groups checkboxes or radios under one label, with the error read out (fieldset + legend). */
export function FieldGroup({
  legend,
  hint,
  error,
  className,
  children,
}: {
  legend: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-1', className)} aria-invalid={error ? true : undefined}>
      <legend className="mb-1 text-sm font-medium text-text">{legend}</legend>
      {children}
      {hint && !error ? <p className="text-sm text-text-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
