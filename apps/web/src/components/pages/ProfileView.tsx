'use client';

import type { PublicListing, PublicProfile } from '@whyme/data';
import { useTaxonomy } from '@whyme/data';
import { CardGrid } from '@/components/market/CardGrid';
import { CategoryName } from '@/components/market/CategoryName';
import { ContactActions } from '@/components/market/ContactActions';
import { ListingCard } from '@/components/market/ListingCard';
import { Photo } from '@/components/market/Photo';
import { PhotoGallery } from '@/components/market/PhotoGallery';
import { SafetyNote } from '@/components/market/SafetyNote';
import { VerifiedBadge } from '@/components/market/VerifiedBadge';
import { KeptPageNote } from '@/components/pwa/KeptPageNote';
import { useT } from '@/lib/i18n';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** A business or service provider's page (LST03, LST04). No contact details: buyers reach them through WHY ME. */
export function ProfileView({ profile, listings }: { profile: PublicProfile; listings: PublicListing[] }) {
  const { t } = useT('market');
  const isProvider = profile.kind === 'provider';

  return (
    <article className="flex flex-col gap-8">
      <KeptPageNote />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Photo src={profile.logo?.medium} alt={profile.display_name} priority className="size-24 shrink-0 rounded-full border border-border" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-text-muted">
            <CategoryName id={profile.category.id} fallback={profile.category.name} /> · {profile.location.name}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {profile.verified ? <VerifiedBadge /> : null}
            {profile.member_since ? <span>{t('memberSince', { year: profile.member_since })}</span> : null}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          {profile.about ? (
            <section>
              <h2 className="mb-2 text-lg font-bold">{t('about')}</h2>
              <p className="whitespace-pre-line">{profile.about}</p>
            </section>
          ) : null}
          {profile.photos.length > 0 ? <PhotoGallery photos={profile.photos} alt={profile.display_name} /> : null}
        </div>

        <aside className="flex flex-col gap-5">
          <ContactActions kind={isProvider ? 'provider' : 'business'} subject={{ type: 'profile', id: profile.id }} />
          <dl className="flex flex-col gap-3 rounded-xl border border-border p-4 text-sm">
            {profile.years_experience ? <p className="font-semibold">{t('experience', { count: profile.years_experience })}</p> : null}
            {profile.rate_note ? <Detail label={t('rates')} value={profile.rate_note} /> : null}
            {profile.availability_note ? <Detail label={t('availability')} value={profile.availability_note} /> : null}
            {isProvider && profile.service_area_ids.length > 0 ? <ServiceAreas ids={profile.service_area_ids.map(Number)} /> : null}
            {profile.opening_hours ? <OpeningHours hours={profile.opening_hours} /> : null}
          </dl>
          <SafetyNote />
        </aside>
      </div>

      <section>
        <h2 className="mb-4 text-xl font-bold">{t('whatTheyOffer')}</h2>
        {listings.length === 0 ? (
          <p className="text-text-muted">{t('nothingListed')}</p>
        ) : (
          <CardGrid>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </CardGrid>
        )}
      </section>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="text-text-muted">{value}</dd>
    </div>
  );
}

function ServiceAreas({ ids }: { ids: number[] }) {
  const { t } = useT('market');
  const { data } = useTaxonomy();
  const names = ids.map((id) => data?.locations.find((l) => l.id === id)?.name).filter(Boolean);
  if (names.length === 0) return null;
  return <Detail label={t('serviceAreas')} value={names.join(', ')} />;
}

function OpeningHours({ hours }: { hours: Record<string, { open: string; close: string }[]> }) {
  const { t } = useT('market');
  return (
    <div>
      <dt className="mb-1 font-semibold">{t('openingHours')}</dt>
      <dd>
        <table className="w-full text-text-muted">
          <tbody>
            {DAYS.map((day) => {
              const periods = hours[day] ?? [];
              return (
                <tr key={day}>
                  <th scope="row" className="py-0.5 pr-3 text-left font-normal text-text">
                    {t(day)}
                  </th>
                  <td className="py-0.5">{periods.length === 0 ? t('closed') : periods.map((p) => `${p.open}–${p.close}`).join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </dd>
    </div>
  );
}
