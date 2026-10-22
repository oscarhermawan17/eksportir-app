import { DEFAULT_LOCALE, LOCALES } from '@balitrade/shared';

// Placeholder home page for the base code. Real pages follow TASKS.md (T05+).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-wider text-gold-text">
        Bali → Russia &amp; CIS
      </p>
      <h1 className="text-4xl font-bold tracking-tight text-primary">BaliTrade</h1>
      <p className="text-lg text-muted">
        Base code is running. Next step: authentication and layout (see TASKS.md).
      </p>
      <div className="rounded-card border border-border bg-card p-5 text-sm">
        <p>
          Languages: {LOCALES.join(', ')} (default: {DEFAULT_LOCALE})
        </p>
        <p className="mt-1 text-muted">API health: http://localhost:4000/api/health</p>
      </div>
    </main>
  );
}
