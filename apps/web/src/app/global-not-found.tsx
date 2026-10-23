import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '404 — BaliTrade' };

// Used for URLs that match no route at all (e.g. an unsupported locale). Plain English on purpose:
// there is no locale to translate with here.
export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center font-sans">
        <p className="text-5xl font-bold text-gold-text">404</p>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted">The page you are looking for does not exist.</p>
        {/* A plain link on purpose: this page renders outside the normal app tree (no router/locale). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="rounded-button bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover">
          Back to home
        </a>
      </body>
    </html>
  );
}
