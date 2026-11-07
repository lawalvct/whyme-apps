import type { ReactNode } from 'react';

export function AuthCard({ title, intro, children, footer }: { title: string; intro: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-text-muted">{intro}</p>
      </div>
      <div className="rounded-2xl border border-border p-5 sm:p-6">{children}</div>
      <div className="text-center text-sm text-text-muted">{footer}</div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
      {message}
    </p>
  );
}
