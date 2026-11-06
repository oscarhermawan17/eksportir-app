import { NotFoundView } from '@/components/layout/not-found-view';

// 404 for shop URLs, so it keeps the navbar and footer around it.
export default function NotFoundPage() {
  return <NotFoundView />;
}
