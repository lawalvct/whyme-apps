'use client';

import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { useT } from '@/lib/i18n';

/**
 * How the buyer can pay, shown beside every button that leads to a payment: card
 * (Visa, Mastercard, Verve) or bank transfer, all on Paystack's page. Simple inline
 * SVGs, so they cost no extra requests and work offline.
 */
export function PaymentMethods({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useT('orders');

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1.5', className)}>
      {compact ? null : <span className="text-xs font-medium text-text-muted">{t('payBy')}</span>}
      <ul className="flex flex-wrap items-center gap-1.5" aria-label={t('payBy')}>
        <Mark label="Visa">
          <VisaMark />
        </Mark>
        <Mark label="Mastercard">
          <MastercardMark />
        </Mark>
        <Mark label="Verve">
          <VerveMark />
        </Mark>
        <Mark label={t('bankTransfer')} wide>
          <BankTransferIcon />
          <span className="text-[11px] leading-none font-semibold text-slate-700">{t('bankTransfer')}</span>
        </Mark>
      </ul>
    </div>
  );
}

function Mark({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <li
      title={label}
      aria-label={label}
      className={cn(
        // Always on white: card marks are designed for a light background, in dark mode too.
        'flex h-7 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 shadow-xs',
        wide ? 'min-w-0' : 'w-11',
      )}
    >
      {children}
    </li>
  );
}

function VisaMark() {
  return (
    <svg viewBox="0 0 48 16" className="h-3.5 w-auto" aria-hidden focusable="false">
      <text
        x="24"
        y="13.2"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="15.5"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="0.4"
        fill="#1434CB"
      >
        VISA
      </text>
    </svg>
  );
}

function MastercardMark() {
  // Two overlapping circles; the overlap is its own colour.
  return (
    <svg viewBox="0 0 46 30" className="h-5 w-auto" aria-hidden focusable="false">
      <circle cx="18" cy="15" r="9" fill="#EB001B" />
      <circle cx="28" cy="15" r="9" fill="#F79E1B" />
      <path d="M23 7.517 A9 9 0 0 1 23 22.483 A9 9 0 0 1 23 7.517 Z" fill="#FF5F00" />
    </svg>
  );
}

function VerveMark() {
  return (
    <svg viewBox="0 0 52 20" className="h-4 w-auto" aria-hidden focusable="false">
      <circle cx="9" cy="10" r="8.5" fill="#E2231A" />
      <path d="M5.2 6.6 L9 13.6 L12.8 6.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="20" y="14.2" fontFamily="Arial, Helvetica, sans-serif" fontSize="12.5" fontWeight="700" fill="#00425F">
        verve
      </text>
    </svg>
  );
}

function BankTransferIcon() {
  // A bank with an arrow: money sent from your bank app.
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 text-primary"
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M4.5 9.5h15" />
      <path d="M6.5 12v5M10.5 12v5M14.5 12v2" />
      <path d="M4 19.5h9" />
      <path d="M16 18h6m-2-2 2 2-2 2" />
    </svg>
  );
}
