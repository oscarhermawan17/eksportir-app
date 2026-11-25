import {
  Banknote,
  ClipboardCheck,
  Coins,
  MessagesSquare,
  Package,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { FaqList, HowItWorksSteps } from '@/components/how-it-works/content-sections';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

const TRUST = [
  { key: 'qc', Icon: ClipboardCheck },
  { key: 'payment', Icon: ShieldCheck },
  { key: 'chat', Icon: MessagesSquare },
  { key: 'cargo', Icon: Package },
] as const;

const SHIPPING = ['s1', 's2', 's3', 's4'] as const;

/** The three methods decided on 2026-10-30; the actual account details live in config and appear on the order. */
const PAYMENT: { key: 'bank' | 'usdt' | 'exchange'; Icon: LucideIcon }[] = [
  { key: 'bank', Icon: Banknote },
  { key: 'usdt', Icon: Coins },
  { key: 'exchange', Icon: Repeat },
];

export async function generateMetadata({ params }: PageProps<'/[locale]/how-it-works'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HowItWorks' });
  return { title: `${t('title')} — BaliTrade` };
}

/**
 * One section = a thin line, its heading in a narrow left column and the content to the right (stacked on a
 * phone). It reads like a reference page rather than a wall of cards (design system v2).
 * `scroll-mt-24` keeps the footer's #payment / #shipping targets clear of the sticky navbar.
 */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 border-t border-border py-10 sm:py-14">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-12">
        <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-balance text-text lg:col-span-4">
          {title}
        </h2>
        <div className="lg:col-span-8">{children}</div>
      </div>
    </section>
  );
}

/**
 * The explanation pages that used to sit on the landing page: the six steps, what BaliTrade does,
 * payment methods and shipping (both linked from the footer), the FAQ and the seller invitation.
 */
export default function HowItWorksPage() {
  const t = useTranslations('HowItWorks');

  return (
    <div className="page-container flex-1 pb-16 sm:pb-20">
      <header className="max-w-3xl py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-text sm:text-4xl">{t('title')}</h1>
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted sm:text-lg">{t('intro')}</p>
      </header>

      {/* A real sequence, so numbered. Written by the OWNER on /admin/content. */}
      <Section id="how" title={t('howTitle')}>
        <HowItWorksSteps />
      </Section>

      <Section id="trust" title={t('trustTitle')}>
        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {TRUST.map(({ key, Icon }) => (
            <li key={key} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-text">{t(`trust.${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(`trust.${key}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Linked from the footer as /how-it-works#payment */}
      <Section id="payment" title={t('paymentTitle')}>
        <ul className="divide-y divide-border border-y border-border">
          {PAYMENT.map(({ key, Icon }) => (
            <li key={key} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <h3 className="flex items-center gap-2.5 text-base font-semibold text-text">
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                {t(`payment.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{t(`payment.${key}.text`)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-muted">{t('paymentNote')}</p>
      </Section>

      {/* Linked from the footer as /how-it-works#shipping */}
      <Section id="shipping" title={t('shippingTitle')}>
        <ul className="max-w-[70ch] list-disc space-y-2.5 pl-5 text-[15px] leading-relaxed text-text marker:text-border-strong">
          {SHIPPING.map((key) => (
            <li key={key}>{t(`shipping.${key}`)}</li>
          ))}
        </ul>
      </Section>

      {/* Written by the OWNER on /admin/content. */}
      <Section id="faq" title={t('faqTitle')}>
        <FaqList />
      </Section>

      <section aria-labelledby="sellers-title" className="rounded-card bg-surface px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 id="sellers-title" className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
              {t('sellersTitle')}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{t('sellersText')}</p>
          </div>
          <Link href="/register?role=seller" className={buttonClasses('primary', 'shrink-0')}>
            {t('becomeSeller')}
          </Link>
        </div>
      </section>
    </div>
  );
}
