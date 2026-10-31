'use client';

import type { AuthUser, Locale, SelfRegisterRole } from '@balitrade/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: SelfRegisterRole;
  locale: Locale;
  /** The sign-up checkbox "a BaliTrade admin is included in all chats"; the API rejects the request without it. */
  acceptAdminInChat: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** `loading` until the first /auth/me answer arrives. */
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  useEffect(() => {
    let cancelled = false;
    apiFetch<AuthUser>('/auth/me')
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      })
      .catch((error: unknown) => {
        // 401 simply means "not logged in"; other errors (API down) also leave the visitor anonymous.
        if (!cancelled) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            console.error('Could not load session', error);
          }
          setStatus('anonymous');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback((me: AuthUser) => {
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      startSession(await apiFetch<AuthUser>('/auth/login', { method: 'POST', body: { email, password } })),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      startSession(await apiFetch<AuthUser>('/auth/register', { method: 'POST', body: input })),
    [startSession],
  );

  const logout = useCallback(async () => {
    await apiFetch<void>('/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const subscribeNothing = () => () => undefined;

/** False while React hydrates server-rendered HTML (and on the server), true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  // The server always renders "session still loading". A part of the page that hydrates later (such as the navbar, inside
  // a Suspense boundary) could otherwise already see the answer of /auth/me and no longer match the server HTML.
  const hydrated = useHydrated();
  return useMemo(() => (hydrated ? value : { ...value, user: null, status: 'loading' as const }), [hydrated, value]);
}
