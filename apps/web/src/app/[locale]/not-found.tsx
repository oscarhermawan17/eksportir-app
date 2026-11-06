import { NotFoundView } from '@/components/layout/not-found-view';

// Fallback 404 for anything outside the shop (the admin area has its own chrome).
export default function NotFoundPage() {
  return <NotFoundView />;
}
