import { Suspense, type ReactNode } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';

/** The seller area replaces the storefront chrome entirely (docs/DESIGN.md, "Dashboard penjual"). */
export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    // usePathname()/useSearchParams() inside the shell and its pages need a Suspense boundary on routes
    // with a dynamic segment.
    <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
      <SellerShell>{children}</SellerShell>
    </Suspense>
  );
}
