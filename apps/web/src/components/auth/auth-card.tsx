import type { ReactNode } from 'react';

/** Centered card used by the login and register pages. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
