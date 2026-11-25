import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import homeBatik from '@/assets/banners/home-batik.jpg';
import { CatalogView } from '@/components/catalog/catalog-view';
import { HomeBanner } from '@/components/home/home-banner';

/**
 * The landing page is the catalog: visitors should see what is for sale, not a brochure.
 * One low banner says what BaliTrade is and links to /how-it-works; becoming a seller is reached from sign-up
 * and from that page, so it has no button here.
 */
export default function Home() {
  const t = useTranslations('Home');

  return (
    <>
      <div className="page-container pt-6 sm:pt-8">
        <HomeBanner
          slide={{
            image: homeBatik,
            title: t('title'),
            text: t('lead'),
            cta: { href: '/how-it-works', label: t('howItWorksLink') },
            credit: {
              label: 'Photo: Tomasz Baranowski, CC BY 2.0',
              href: 'https://commons.wikimedia.org/wiki/File:Colours_(44715257464).jpg',
            },
          }}
        />
      </div>

      {/* CatalogView reads the search parameters (?q=, ?category=, ?type=), which needs a Suspense boundary. */}
      <Suspense>
        <CatalogView />
      </Suspense>
    </>
  );
}
