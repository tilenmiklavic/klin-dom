import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, tokens } from '@klindom/ui';
import { usePush } from '../../src/push/usePush';

const blockedLine = {
  'needs-install': 'notifications.needsInstall',
  denied: 'notifications.denied',
  unsupported: 'notifications.unsupported',
} as const;

/** Last onboarding step: offer reminders on this device, then land on the tabs either way. */
export default function Reminders() {
  const { t } = useTranslation();
  const router = useRouter();
  const device = usePush();
  const done = () => router.replace('/(tabs)');
  // States where turning on can't work here: explain calmly (same lines as the Notifications screen) and move on.
  const blocked = device.state === null || device.state === 'off' || device.state === 'on' ? null : blockedLine[device.state];
  const turnOn = async () => {
    await device.enable();
    done();
  };

  return (
    <Screen title={t('onboarding.reminders.title')}>
      <KText variant="body" color="inkMuted">
        {t('onboarding.reminders.hint')}
      </KText>
      {blocked ? (
        <>
          <KText variant="body">{t(blocked)}</KText>
          <Button variant="chip" label={t('common.continue')} onPress={done} />
        </>
      ) : (
        <View style={{ gap: tokens.space[3] }}>
          <Button label={t('onboarding.reminders.turnOn')} loading={device.busy} onPress={() => void turnOn()} />
          <Button variant="chip" label={t('onboarding.reminders.notNow')} disabled={device.busy} onPress={done} />
        </View>
      )}
    </Screen>
  );
}
