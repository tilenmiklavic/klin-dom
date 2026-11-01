import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, ListGroup, ListRow, Screen, tokens } from '@klindom/ui';
import { useCreateInvite } from '../../src/data/invites';
import { useShareInvite } from '../../src/invite/useShareInvite';

export default function Invite() {
  const { t } = useTranslation();
  const router = useRouter();
  const { homeId, homeName } = useLocalSearchParams<{ homeId: string; homeName?: string }>();
  const invite = useCreateInvite(homeId);
  const started = useRef(false);
  useEffect(() => {
    if (homeId && !started.current) {
      started.current = true;
      invite.mutate();
    }
  }, [homeId, invite]);

  const link = invite.data?.url;
  const shareLink = useShareInvite(homeName ?? '');
  const share = async () => {
    if (link) await shareLink(link);
  };

  return (
    <Screen title={t('invite.title')}>
      <KText variant="body" color="inkMuted">
        {t('invite.hint')}
      </KText>
      {invite.isError ? (
        <View style={{ gap: tokens.space[3] }}>
          <KText variant="body">{t('invite.failed')}</KText>
          <Button variant="secondary" label={t('gate.retry')} onPress={() => invite.mutate()} />
        </View>
      ) : (
        <ListGroup>
          <ListRow label={t('invite.code')} value={invite.data?.code ?? ''} />
        </ListGroup>
      )}
      <View style={{ gap: tokens.space[3] }}>
        <Button label={t('invite.share')} disabled={!link} onPress={() => void share()} />
        <Button variant="chip" label={t('common.continue')} onPress={() => router.replace('/(onboarding)/reminders')} />
      </View>
    </Screen>
  );
}
