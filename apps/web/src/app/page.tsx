import { CategoryChips } from '@/components/home/CategoryChips';
import { HomeHero } from '@/components/home/HomeHero';
import { Section } from '@/components/home/Section';
import { CardGrid } from '@/components/market/CardGrid';
import { ListingCard } from '@/components/market/ListingCard';
import { ProfileCard } from '@/components/market/ProfileCard';
import { routes } from '@/lib/format';
import { getLatestListings, getLatestProfiles, getTaxonomy } from '@/lib/server-api';

/** Home: search, service categories, newest offers and providers. Cached for minutes. */
export default async function HomePage() {
  const [products, services, providers, taxonomy] = await Promise.all([
    getLatestListings('product'),
    getLatestListings('service'),
    getLatestProfiles('provider'),
    getTaxonomy(),
  ]);
  const serviceCategories = (taxonomy?.categories ?? []).filter((c) => c.type === 'service');

  return (
    <>
      <HomeHero />
      <CategoryChips categories={serviceCategories} />

      <Section titleKey="latestProducts" href={routes.search({ kind: 'product' })} empty={products.length === 0}>
        <CardGrid>
          {products.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </CardGrid>
      </Section>

      <Section titleKey="providersNearYou" href={routes.search({ type: 'people', kind: 'provider' })} empty={providers.length === 0}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      </Section>

      <Section titleKey="latestServices" href={routes.search({ kind: 'service' })} empty={services.length === 0}>
        <CardGrid>
          {services.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </CardGrid>
      </Section>
    </>
  );
}
