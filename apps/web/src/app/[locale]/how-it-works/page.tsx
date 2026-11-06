import {
  Banknote,
  ChevronDown,
  ClipboardCheck,
  Coins,
  MessagesSquare,
  Package,
  Plane,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const TRUST = [
  { key: 'qc', Icon: ClipboardCheck },
  { key: 'payment', Icon: ShieldCheck },
  { key: 'chat', Icon: MessagesSquare },
  { key: 'cargo', Icon: Package },
] as const;

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;
const FAQ = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;
const SHIPPING = ['s1', 's2', 's3', 's4'] as const;

/** The three methods decided on 2026-10-30; the actual account details live in config and appear on the order. */
const PAYMENT: { key: 'bank' | 'usdt' | 'exchange'; Icon: LucideIcon }[] = [
  { key: 'bank', Icon: Banknote },
  { key: 'usdt', Icon: Coins },
  { key: 'exchange', Icon: Repeat },
];

const SECTION = 'mx-auto w-full max-w-6xl px-4';

export async function generateMetadata({ params }: PageProps<'/[locale]/how-it-works'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HowItWorks' });
  return { title: `${t('title')} — BaliTrade` };
}

/**
 * The explanation pages that used to sit on the landing page: the six steps, what BaliTrade does,
 * payment methods and shipping (both linked from the footer), the FAQ and the seller invitation.
 */
export default function HowItWorksPage() {
  const t = useTranslations('HowItWorks');

  return (
    <div className="flex flex-1 flex-col gap-16 pb-16 sm:gap-20 sm:pb-20">
      <section className="border-b border-border bg-card">
        <div className={`${SECTION} py-12 sm:py-16`}>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">{t('title')}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{t('intro')}</p>
        </div>
      </section>

      {/* A real sequence, so numbered. */}
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

      <section aria-labelledby="trust-title" className={SECTION}>
        <h2 id="trust-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('trustTitle')}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ key, Icon }) => (
            <li key={key} className="rounded-card border border-border bg-card p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-text">{t(`trust.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`trust.${key}.text`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Linked from the footer as /how-it-works#payment */}
      <section id="payment" aria-labelledby="payment-title" className={`${SECTION} scroll-mt-24`}>
        <h2 id="payment-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('paymentTitle')}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {PAYMENT.map(({ key, Icon }) => (
            <li key={key} className="rounded-card border border-border bg-card p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-gold-text">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-semibold text-text">{t(`payment.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`payment.${key}.text`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm text-muted">{t('paymentNote')}</p>
      </section>

      {/* Linked from the footer as /how-it-works#shipping */}
      <section id="shipping" aria-labelledby="shipping-title" className={`${SECTION} scroll-mt-24`}>
        <h2 id="shipping-title" className="text-2xl font-bold text-text sm:text-3xl">
          {t('shippingTitle')}
        </h2>
        <ul className="mt-6 max-w-3xl space-y-3">
          {SHIPPING.map((key) => (
            <li key={key} className="flex gap-3 rounded-card border border-border bg-card p-4 text-sm text-text shadow-sm">
              <Plane className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              {t(`shipping.${key}`)}
            </li>
          ))}
        </ul>
      </section>

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
    </div>
  );
}
