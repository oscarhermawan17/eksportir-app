import { Suspense, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';

/** The admin area replaces the storefront chrome entirely (docs/DESIGN.md, "Layout admin"). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    // usePathname() inside the shell needs a Suspense boundary on routes with a dynamic segment.
    <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
