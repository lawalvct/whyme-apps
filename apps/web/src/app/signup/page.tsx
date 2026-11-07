import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
