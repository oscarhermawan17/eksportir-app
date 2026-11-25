import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Wordmark only, one colour (design system v2): no symbol until the brand has a real one.
 * `translate="no"` keeps browser translation from rewriting the name. `href` defaults to the shop.
 */
export function Logo({ onDark = false, href = '/' }: { onDark?: boolean; href?: string }) {
  const t = useTranslations('Common');
  return (
    <Link
      href={href}
      translate="no"
      aria-label={t('homeAria')}
      className={`shrink-0 rounded-button text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 ${
        onDark ? 'text-white focus-visible:outline-white' : 'text-primary focus-visible:outline-primary'
      }`}
    >
      BaliTrade
    </Link>
  );
}
