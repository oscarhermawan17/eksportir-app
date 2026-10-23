import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Redirects "/" to the visitor's locale (NEXT_LOCALE cookie, then Accept-Language, then "en").
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
