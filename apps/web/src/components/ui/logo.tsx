import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Text logo with the gold frangipani mark (design system 01-v4). */
export function Logo({ onDark = false }: { onDark?: boolean }) {
  const t = useTranslations('Common');
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={t('homeAria')}>
      <svg className="h-8 w-8" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3C16 10 10 16 3 16C10 16 16 22 16 29C16 22 22 16 29 16C22 16 16 10 16 3Z" fill="#C9A24A" />
        <circle cx="16" cy="16" r="3.5" fill={onDark ? '#0B3A46' : '#0F4C5C'} />
      </svg>
      <span className={`text-2xl font-bold tracking-tight ${onDark ? 'text-white' : 'text-primary'}`}>
        Bali<span className="text-gold">Trade</span>
      </span>
    </Link>
  );
}
