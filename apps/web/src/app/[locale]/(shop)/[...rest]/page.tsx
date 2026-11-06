import { notFound } from 'next/navigation';

// Any URL under /en, /id, /ru that has no page ends up here and shows the localized not-found page.
// This page never renders content (it only triggers the 404), so there is nothing to validate for instant navigation.
export const instant = false;

export default function UnknownPage() {
  notFound();
}
