import { PRODUCT_CATEGORIES } from '@balitrade/shared';
import type { ProductCategory } from '@balitrade/shared';
import {
  Armchair,
  Check,
  ChevronDown,
  ClipboardCheck,
  Coffee,
  Flower2,
  Lamp,
  MessagesSquare,
  Package,
  Search,
  Shirt,
  ShieldCheck,
  ShoppingBag,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FeaturedProducts, HeroCollage } from '@/components/home/latest-products';
import { Button, buttonClasses } from '@/components/ui/button';
import { inputClasses } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';

const CATEGORY_ICONS: Record<ProductCategory, LucideIcon> = {
  COFFEE_TEA: Coffee,
  FOOD_SPICES: Wheat,
  HANDICRAFTS: Package,
  HOME_DECOR: Lamp,
  FASHION_APPAREL: Shirt,
  BAGS_ACCESSORIES: ShoppingBag,
  BEAUTY_WELLNESS: Flower2,
  FURNITURE: Armchair,
  OTHER: Package,
};

const TRUST = [
  { key: 'qc', Icon: ClipboardCheck },
  { key: 'payment', Icon: ShieldCheck },
  { key: 'chat', Icon: MessagesSquare },
  { key: 'cargo', Icon: Package },
] as const;

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;
const FAQ = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

const SECTION = 'mx-auto w-full max-w-6xl px-4';

export default function Home() {
  const t = useTranslations('Home');
  const tProducts = useTranslations('Products');
  const locale = useLocale();

  return (
    <div className="flex flex-1 flex-col gap-16 pb-16 sm:gap-20 sm:pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Very subtle Balinese-inspired dot pattern (design system: hero and footer only) */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-1/2 opacity-[0.12] [background-image:radial-gradient(#C9A24A_1px,transparent_1px)] [background-size:24px_24px] lg:block"
        />
        <div className={`${SECTION} relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr]`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gold-text">{t('eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl lg:text-5xl">{t('title')}</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">{t('text')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products" className={buttonClasses('primary')}>
                {t('browse')}
              </Link>
              <Link href="/register?role=seller" className={buttonClasses('secondary')}>
                {t('becomeSeller')}
              </Link>
            </div>
            {/* A plain GET form: works without JavaScript and lands on the catalog with ?q= */}
            <form action={`/${locale}/products`} method="get" role="search" className="mt-6 flex max-w-xl gap-2">
              <label htmlFor="hero-search" className="sr-only">
                {t('searchLabel')}
              </label>
              <input
                id="hero-search"
                name="q"
                type="search"
                maxLength={100}
                placeholder={t('searchPlaceholder')}
                className={inputClasses}
              />
              <Button type="submit" className="shrink-0">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('searchButton')}</span>
                <span className="sr-only sm:hidden">{t('searchButton')}</span>
              </Button>
            </form>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text">
              {(['qc', 'payment', 'cargo'] as const).map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success" aria-hidden="true" />
                  {t(`checks.${key}`)}
                </li>
              ))}
            </ul>
          </div>
          <HeroCollage />
        </div>
      </section>

      {/* Trust */}
      <section aria-label={t('checks.qc')} className={SECTION}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ key, Icon }) => (
            <li key={key} className="rounded-card border border-border bg-card p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-base font-semibold text-text">{t(`trust.${key}.title`)}</h2>
              <p className="mt-1 text-sm text-muted">{t(`trust.${key}.text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works: a real sequence, so numbered */}
      <section aria-labelledby="how-title" className={SECTION}>
        <h2 id="how-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('howTitle')}
        </h2>
        <ol className="relative mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
          <div aria-hidden="true" className="absolute left-0 right-0 top-5 hidden h-px bg-border lg:block" />
          {STEPS.map((step, index) => (
            <li key={step} className="relative flex gap-4 lg:block">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-primary ring-4 ring-background">
                {index + 1}
              </span>
              <div className="lg:mt-3">
                <h3 className="text-base font-semibold text-text">{t(`steps.${step}.title`)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`steps.${step}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-title" className={SECTION}>
        <h2 id="categories-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('categoriesTitle')}
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRODUCT_CATEGORIES.filter((category) => category !== 'OTHER').map((category) => {
            const Icon = CATEGORY_ICONS[category];
            return (
              <li key={category}>
                <Link
                  href={`/products?category=${category}`}
                  className="flex h-full items-center gap-3 rounded-card border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-text">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-text">{tProducts(`categories.${category}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <FeaturedProducts />

      {/* For sellers */}
      <section aria-labelledby="sellers-title" className={SECTION}>
        <div className="relative overflow-hidden rounded-card bg-primary px-6 py-10 text-white sm:px-10">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-10 [background-image:radial-gradient(#C9A24A_1px,transparent_1px)] [background-size:24px_24px]"
          />
          <div className="relative max-w-2xl">
            <h2 id="sellers-title" className="text-2xl font-bold sm:text-3xl">
              {t('sellersTitle')}
            </h2>
            <p className="mt-3 text-white/85">{t('sellersText')}</p>
            <Link
              href="/register?role=seller"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-button bg-gold px-5 text-sm font-semibold text-text transition hover:bg-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t('becomeSeller')}
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className={`${SECTION} max-w-3xl`}>
        <h2 id="faq-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('faqTitle')}
        </h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <details key={item} className="group rounded-card border border-border bg-card px-5 py-4 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                {t(`faq.${item}.q`)}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-sm text-muted">{t(`faq.${item}.a`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
