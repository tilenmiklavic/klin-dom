import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { tokens } from '@klindom/ui';
import { useBootstrap } from '../data/useBootstrap';
import { useAuth } from './AuthProvider';
import { pendingInvite } from './pendingInvite';

/**
 * Routes by session state: signed out -> Welcome; signed in without homes -> onboarding; otherwise the tabs.
 * A pending invite code (saved by /join/[code]) takes the user to the join screen right after sign-in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const bootstrap = useBootstrap();
  const router = useRouter();
  const queryClient = useQueryClient();
  const group = useSegments()[0];

  useEffect(() => {
    if (status === 'signedOut') queryClient.clear();
  }, [status, queryClient]);

  const homes = bootstrap.data?.homes;
  useEffect(() => {
    let cancelled = false;
    async function route() {
      if (status === 'signedOut') {
        if (group !== '(auth)') router.replace('/(auth)/welcome');
        return;
      }
      if (status !== 'signedIn' || !homes) return;
      if (group === '(auth)') {
        const code = await pendingInvite.get();
        if (cancelled) return;
        if (code) return router.replace({ pathname: '/join/[code]', params: { code } });
      }
      if (homes.length === 0) {
        if (group !== '(onboarding)' && group !== 'join') router.replace('/(onboarding)/start');
      } else if (group === '(auth)' || group === '(onboarding)') {
        router.replace('/(tabs)');
      }
    }
    void route();
    return () => {
      cancelled = true;
    };
  }, [status, homes, group, router]);

  const ready = status === 'signedOut' || (status === 'signedIn' && !bootstrap.isPending);
  return (
    <>
      {children}
      {ready ? null : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tokens.color.surface }]} />}
    </>
  );
}
