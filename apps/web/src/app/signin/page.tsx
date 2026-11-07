import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
