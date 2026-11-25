import { IBM_Plex_Sans } from 'next/font/google';

/**
 * The one place the app's typeface is chosen. Every layout reads `fontSans.variable`, and `globals.css` maps
 * `--font-app` to Tailwind's `font-sans`, so switching typefaces means changing this file only.
 * The family must cover Cyrillic: Russian is one of the three UI languages.
 */
export const fontSans = IBM_Plex_Sans({
  variable: '--font-app',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
