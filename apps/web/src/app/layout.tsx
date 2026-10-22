import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin', 'cyrillic-ext'],
});

export const metadata: Metadata = {
  title: 'BaliTrade',
  description: 'B2B export marketplace — authentic products from Bali to Russia & CIS',
};

// Locale routing (/en, /id, /ru) is added in task T06.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
