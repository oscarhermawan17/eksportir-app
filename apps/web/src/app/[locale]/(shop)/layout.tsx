import { Suspense, type ReactNode } from 'react';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';

/** Storefront chrome: everything buyers and sellers see. The admin area uses its own layout. */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* usePathname() inside Navbar needs a Suspense boundary on routes with a dynamic segment such as [id]. */}
      <Suspense fallback={<div className="h-16 border-b border-border bg-card" aria-hidden="true" />}>
        <Navbar />
      </Suspense>
      <main className="flex flex-1 flex-col">{children}</main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
