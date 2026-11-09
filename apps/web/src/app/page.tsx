import { HomeHero } from '@/components/home/HomeHero';
import { HomeMarketplace } from '@/components/home/HomeMarketplace';
import { getLatestListings, getLatestProfiles, getTaxonomy } from '@/lib/server-api';

/** Home: marketplace discovery, newest offers and local providers. Cached for minutes. */
export default async function HomePage() {
  const [products, services, providers, taxonomy] = await Promise.all([
    getLatestListings('product'),
    getLatestListings('service'),
    getLatestProfiles('provider'),
    getTaxonomy(),
  ]);
  return (
    <>
      <HomeHero />
      <HomeMarketplace products={products} services={services} providers={providers} categories={taxonomy?.categories ?? []} />
    </>
  );
}
