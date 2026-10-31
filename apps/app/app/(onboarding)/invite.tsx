import { useEffect, useRef } from 'react';
import { Platform, Share, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Button, KText, ListGroup, ListRow, Screen, tokens, useToast } from '@klindom/ui';
import { useCreateInvite } from '../../src/data/invites';

export default function Invite() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
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
  const share = async () => {
    if (!link) return;
    try {
      // Android ignores `url`, so its message carries the link; elsewhere the link rides along separately.
      const message = t(Platform.OS === 'android' ? 'invite.messageWithLink' : 'invite.message', { home: homeName ?? '', url: link });
      await Share.share({ message, url: link });
    } catch (error) {
      // Dismissing the browser's share sheet is not a failure.
      if (Platform.OS === 'web' && error instanceof Error && error.name === 'AbortError') return;
      await Clipboard.setStringAsync(link);
      toast.show({ message: t('invite.copied') });
    }
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
        <Button variant="chip" label={t('common.continue')} onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}
