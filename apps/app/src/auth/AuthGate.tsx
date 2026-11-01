import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, KText, tokens } from '@klindom/ui';
import { useBootstrap } from '../data/useBootstrap';
import { useAuth } from './AuthProvider';
import { currentHomeStore } from '../state/currentHome';
import { pendingInvite } from './pendingInvite';

/**
 * Routes by session state: signed out -> Welcome; signed in without homes -> onboarding; otherwise the tabs.
 * A pending invite code (saved by /join/[code]) takes the user to the join screen right after sign-in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status, signOut } = useAuth();
  const bootstrap = useBootstrap();
  const router = useRouter();
  const queryClient = useQueryClient();
  const segments = useSegments();
  const group = segments[0];
  // The invite and reminders steps come right after creating a home, so they must stay reachable once homes exist.
  const step = (segments as string[])[1];
  const inviting = group === '(onboarding)' && (step === 'invite' || step === 'reminders');

  useEffect(() => {
    if (status === 'signedOut') {
      queryClient.clear();
      currentHomeStore.clear();
    }
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
      } else if (group === '(auth)' || (group === '(onboarding)' && !inviting)) {
        router.replace('/(tabs)');
      }
    }
    void route();
    return () => {
      cancelled = true;
    };
  }, [status, homes, group, inviting, router]);

  // Show children only when the current route is where the session state says the user belongs;
  // otherwise hide them (kept mounted so navigation still works) so protected screens never flash.
  const failed = status === 'signedIn' && bootstrap.isError && !homes;
  let belongs = false;
  if (status === 'signedOut') belongs = group === '(auth)';
  else if (status === 'signedIn' && homes) {
    belongs = homes.length === 0 ? group === '(onboarding)' || group === 'join' : group !== '(auth)' && (group !== '(onboarding)' || inviting);
  }
  return (
    <>
      <View style={belongs ? { flex: 1 } : { display: 'none' }}>{children}</View>
      {belongs ? null : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: tokens.color.surface,
            alignItems: 'center',
            justifyContent: 'center',
            padding: tokens.space[6],
            gap: tokens.space[4],
          }}
        >
          {failed ? (
            <>
              <KText variant="title" style={{ textAlign: 'center' }}>
                {t('gate.errorTitle')}
              </KText>
              <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
                {t('gate.errorBody')}
              </KText>
              <Button label={t('gate.retry')} loading={bootstrap.isFetching} onPress={() => void bootstrap.refetch()} />
              <Button variant="chip" label={t('gate.signOut')} onPress={() => void signOut()} />
            </>
          ) : null}
        </View>
      )}
    </>
  );
}
