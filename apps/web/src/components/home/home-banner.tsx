import Image, { type StaticImageData } from 'next/image';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export type BannerSlide = {
  image: StaticImageData;
  title: string;
  text: string;
  cta: { href: string; label: string };
  /** Required by the photo's licence (see src/assets/banners/CREDITS.md). */
  credit: { label: string; href: string };
};

/**
 * The banner above the catalog: one photo, one line, one button. It takes a slide object so that a carousel can
 * later render several of them without changing this markup; for now there is exactly one.
 * Kept low (240px; on a phone it grows with the text) so the first row of products stays on the first screen.
 */
export function HomeBanner({ slide }: { slide: BannerSlide }) {
  return (
    <section className="relative isolate flex min-h-[220px] items-center overflow-hidden rounded-card bg-primary py-8 sm:h-[240px] sm:py-0">
      <Image
        src={slide.image}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="(min-width: 1200px) 1136px, 100vw"
        className="-z-20 object-cover"
      />
      {/* Navy wash from the left, so white text stays readable on a busy photo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1a2b]/90 via-[#0b1a2b]/60 to-[#0b1a2b]/10"
      />
      <div className="max-w-xl px-6 sm:px-10">
        <h1 className="text-xl font-semibold tracking-tight text-balance text-white sm:text-3xl">{slide.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-pretty text-white/85">{slide.text}</p>
        <Link
          href={slide.cta.href}
          className={buttonClasses(
            'secondary',
            'mt-5 h-10 border-transparent bg-white text-primary hover:border-transparent hover:bg-white/90 focus-visible:outline-white',
          )}
        >
          {slide.cta.label}
        </Link>
      </div>
      <a
        href={slide.credit.href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-3 bottom-2 text-[11px] text-white/60 hover:text-white hover:underline"
      >
        {slide.credit.label}
      </a>
    </section>
  );
}
