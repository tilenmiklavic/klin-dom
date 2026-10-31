import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getConfig } from '../config';
import { devTokenStore, signInDev as mintDevToken } from './devAuth';
import { supabaseAuth } from './supabase';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  getToken(): Promise<string | null>;
  /** Refreshes the session after a 401. Resolves false (and signs out) when it cannot. */
  refresh(): Promise<boolean>;
  signInWithGoogle(): Promise<void>;
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  signInDev(name: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const unsupported = (what: string) => async (): Promise<never> => {
  throw new Error(`${what} is not available in this auth mode`);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = getConfig().authMode;
  const [status, setStatus] = useState<AuthStatus>('loading');
  const tokenRef = useRef<string | null>(null);
  const refreshing = useRef<Promise<boolean> | null>(null);

  const applyToken = useCallback((token: string | null) => {
    tokenRef.current = token;
    setStatus(token ? 'signedIn' : 'signedOut');
  }, []);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    const initial = mode === 'dev' ? devTokenStore.get() : supabaseAuth.getAccessToken();
    initial.then(
      (token) => alive && applyToken(token),
      () => alive && applyToken(null),
    );
    if (mode === 'supabase') unsubscribe = supabaseAuth.onChange((token) => alive && applyToken(token));
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [mode, applyToken]);

  const signOut = useCallback(async () => {
    if (mode === 'dev') await devTokenStore.clear();
    else await supabaseAuth.signOut().catch(() => undefined);
    applyToken(null);
  }, [mode, applyToken]);

  const refresh = useCallback((): Promise<boolean> => {
    // Concurrent 401s share one refresh.
    refreshing.current ??= (async () => {
      try {
        // Dev tokens last 30 days and cannot be refreshed.
        const token = mode === 'dev' ? null : await supabaseAuth.refresh();
        if (token) {
          applyToken(token);
          return true;
        }
      } catch {
        // fall through to sign-out
      }
      await signOut();
      return false;
    })().finally(() => {
      refreshing.current = null;
    });
    return refreshing.current;
  }, [mode, applyToken, signOut]);

  const getToken = useCallback(async () => tokenRef.current, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      getToken,
      refresh,
      signOut,
      ...(mode === 'dev'
        ? {
            signInWithGoogle: unsupported('Google sign-in'),
            sendEmailCode: unsupported('Email sign-in'),
            verifyEmailCode: unsupported('Email sign-in'),
            signInDev: async (name: string) => applyToken(await mintDevToken(name)),
          }
        : {
            signInWithGoogle: () => supabaseAuth.signInWithGoogle(),
            sendEmailCode: (email: string) => supabaseAuth.sendEmailCode(email),
            verifyEmailCode: (email: string, code: string) => supabaseAuth.verifyEmailCode(email, code),
            signInDev: unsupported('Dev sign-in'),
          }),
    }),
    [status, mode, getToken, refresh, signOut, applyToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
