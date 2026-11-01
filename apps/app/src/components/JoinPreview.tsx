import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, tokens } from '@klindom/ui';
import { apiErrorText } from '../errors/apiErrorText';
import { pendingInvite } from '../auth/pendingInvite';
import { useAcceptInvite, useInvitePreview, useRefreshBootstrap } from '../data/homes';
import { normalizeInviteCode } from '../data/invites';
import { useCurrentHome } from '../state/currentHome';

/** Shows who invited you and to which home, then joins on confirm. Shared by the code entry and deep links. */
export function JoinPreview({ rawCode }: { rawCode: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const code = normalizeInviteCode(rawCode);
  const preview = useInvitePreview(code);
  const accept = useAcceptInvite();
  const refresh = useRefreshBootstrap();
  const { homeId, setHomeId } = useCurrentHome();

  const leave = async (to: 'start' | 'code') => {
    await pendingInvite.clear();
    // Someone who already has a home goes back to it; a newcomer goes back into onboarding.
    router.replace(homeId ? '/(tabs)' : to === 'start' ? '/(onboarding)/start' : '/(onboarding)/join');
  };

  const join = () =>
    accept.mutate(code, {
      async onSuccess(home) {
        setHomeId(home.id);
        await pendingInvite.clear();
        await refresh();
        router.replace('/(tabs)');
      },
    });

  if (preview.isError) {
    return (
      <Screen title={t('join.invalidTitle')}>
        <KText variant="body" color="inkMuted">
          {apiErrorText(t, preview.error, { invite: true })}
        </KText>
        <Button label={t('join.tryAnother')} onPress={() => void leave('code')} />
      </Screen>
    );
  }
  if (!preview.data) return <Screen title={t('join.loading')}>{null}</Screen>;

  const { homeName, inviterName } = preview.data;
  return (
    <Screen title={t('join.confirmTitle', { home: homeName })}>
      <KText variant="body" color="inkMuted">
        {inviterName ? t('join.invitedBy', { name: inviterName }) : t('join.invited')}
      </KText>
      {accept.isError ? (
        <KText variant="caption" color="brandStrong">
          {apiErrorText(t, accept.error, { invite: true })}
        </KText>
      ) : null}
      <View style={{ gap: tokens.space[3] }}>
        <Button label={t('join.confirm')} loading={accept.isPending} onPress={join} />
        <Button variant="chip" label={t('join.notNow')} onPress={() => void leave('start')} />
      </View>
    </Screen>
  );
}
