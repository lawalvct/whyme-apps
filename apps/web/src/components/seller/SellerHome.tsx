'use client';

import { useMyProfiles, type OwnerProfile, type ProfileKind } from '@whyme/data';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';
import { Card, PageTitle, sellerCapabilities, StatusBadge, StatusNote } from './common';
import { StartSelling } from './StartSelling';

/** The seller centre's front page: their pages, their listings, and what to do next. */
export function SellerHome() {
  const { t } = useT('seller');
  const { user } = useAccount();
  const caps = sellerCapabilities(user);
  const isSeller = caps.vendor || caps.provider;
  const profiles = useMyProfiles(isSeller);

  if (!isSeller) return <StartSelling />;

  const profile = (kind: ProfileKind) => profiles.data?.find((p) => p.kind === kind) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={t('hello', { name: user?.first_name ?? '' })} />

      <div className="grid gap-4 md:grid-cols-2">
        {caps.vendor ? <ProfileCard kind="business" profile={profile('business')} loading={profiles.isPending} /> : null}
        {caps.provider ? <ProfileCard kind="provider" profile={profile('provider')} loading={profiles.isPending} /> : null}

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{t('listingsCard')}</h2>
          <p className="text-sm text-text-muted">{t('listingsCardHint')}</p>
          <div className="mt-auto flex flex-wrap gap-2">
            {caps.vendor ? <ButtonLink href={routes.newListing('product')}>{t('addProduct')}</ButtonLink> : null}
            {caps.provider ? (
              <ButtonLink href={routes.newListing('service')} variant={caps.vendor ? 'secondary' : 'primary'}>
                {t('addService')}
              </ButtonLink>
            ) : null}
            <ButtonLink href={routes.sellListings()} variant="ghost">
              {t('manageListings')}
            </ButtonLink>
          </div>
        </Card>
      </div>

      {caps.vendor && caps.provider ? null : <StartSelling only={caps.vendor ? 'provider' : 'vendor'} compact />}
    </div>
  );
}

function ProfileCard({ kind, profile, loading }: { kind: ProfileKind; profile: OwnerProfile | null; loading: boolean }) {
  const { t } = useT('seller');

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{kind === 'business' ? t('businessPage') : t('providerPage')}</h2>
        {loading ? null : profile ? <StatusBadge status={profile.status} /> : <span className="text-sm text-text-muted">{t('notStarted')}</span>}
      </div>

      {loading ? (
        <Skeleton className="h-12 w-full" />
      ) : profile ? (
        <>
          <p className="font-semibold">{profile.display_name}</p>
          <StatusNote status={profile.status} reason={profile.status_reason} />
        </>
      ) : (
        <p className="text-sm text-text-muted">{kind === 'business' ? t('businessPageHint') : t('providerPageHint')}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink href={routes.sellProfile(kind)} variant={profile ? 'secondary' : 'primary'}>
          {profile?.status === 'pending_review' ? t('view') : profile ? t('editPage') : t('setUpPage')}
        </ButtonLink>
        {profile?.status === 'published' ? (
          <ButtonLink href={routes.profile(profile)} variant="ghost">
            {t('viewPage')}
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}
