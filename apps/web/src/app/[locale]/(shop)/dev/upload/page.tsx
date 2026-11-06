import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UploadDemo } from './upload-demo';

export const metadata: Metadata = { title: 'Upload test — BaliTrade', robots: { index: false } };

// Development-only playground for the media upload. The product form (T09) reuses MediaUploader.
export default function UploadDevPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <UploadDemo />;
}
