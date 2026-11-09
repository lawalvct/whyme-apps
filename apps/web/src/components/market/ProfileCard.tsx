'use client';

import Link from 'next/link';
import type { PublicProfile } from '@whyme/data';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { CategoryName } from './CategoryName';
import { Photo } from './Photo';
import { VerifiedBadge } from './VerifiedBadge';

export function ProfileCard({ profile }: { profile: PublicProfile }) {
  const { t } = useT('market');

  return (
    <Link
      href={routes.profile(profile)}
      className="group flex min-w-0 gap-3 rounded-xl border border-border bg-background p-3 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Photo src={profile.logo?.thumb} alt={profile.display_name} className="size-16 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="truncate font-semibold text-text group-hover:text-primary">{profile.display_name}</h3>
        <p className="truncate text-sm text-text-muted">
          <CategoryName id={profile.category.id} fallback={profile.category.name} /> · {profile.location.name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          {profile.verified ? <VerifiedBadge /> : null}
          {profile.years_experience ? <span>{t('experience', { count: profile.years_experience })}</span> : null}
        </div>
      </div>
    </Link>
  );
}
