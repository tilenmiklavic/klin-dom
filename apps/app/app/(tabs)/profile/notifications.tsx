import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TimeOfDay } from '@klindom/shared';
import { Button, KText, ListGroup, ListRow, Screen, TextField, tokens, useToast } from '@klindom/ui';
import { useMemberSettings, useUpdateMemberSettings } from '../../../src/data/notifications';
import { apiErrorText } from '../../../src/errors/apiErrorText';
import { usePush } from '../../../src/push/usePush';
import { useCurrentHome } from '../../../src/state/currentHome';

export default function Notifications() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const settings = useMemberSettings(homeId);
  const update = useUpdateMemberSettings(homeId ?? '');
  const device = usePush();
  const [time, setTime] = useState('');
  const [timeError, setTimeError] = useState<string | undefined>();
  const saved = settings.data?.defaultReminderTime;

  useEffect(() => {
    if (saved) setTime(saved);
  }, [saved]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const save = async (input: Parameters<typeof update.mutateAsync>[0], message?: string) => {
    try {
      await update.mutateAsync(input);
      if (message) toast.show({ message });
    } catch (e) {
      toast.show({ message: apiErrorText(t, e, { fallback: 'errors.saveFailed' }) });
    }
  };
  const saveTime = () => {
    const value = time.trim();
    if (!TimeOfDay.safeParse(value).success) {
      setTimeError(t('notifications.timeInvalid'));
      return;
    }
    void save({ defaultReminderTime: value }, t('notifications.timeSaved'));
  };

  return (
    <Screen title={t('profile.notifications')} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      {settings.isError ? (
        <View style={{ gap: tokens.space[3] }}>
          <KText variant="body" color="inkMuted">
            {t('profile.loadFailed')}
          </KText>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void settings.refetch()} />
        </View>
      ) : null}
      {settings.data ? (
        <>
          <View
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.space[4],
              paddingHorizontal: tokens.space[4],
              borderRadius: tokens.radius.md,
              backgroundColor: tokens.color.surfaceRaised,
              boxShadow: tokens.shadow.card,
            }}
          >
            <KText variant="body" style={{ flexShrink: 1 }}>
              {t('notifications.reminders')}
            </KText>
            <Switch
              accessibilityLabel={t('notifications.reminders')}
              value={settings.data.notificationsEnabled}
              disabled={update.isPending}
              trackColor={{ false: tokens.color.track, true: tokens.color.brand }}
              thumbColor={tokens.color.surfaceRaised}
              onValueChange={(v) => void save({ notificationsEnabled: v })}
            />
          </View>
          <View style={{ gap: tokens.space[3] }}>
            <TextField
              label={t('notifications.morningTime')}
              value={time}
              onChangeText={(v) => {
                setTime(v);
                setTimeError(undefined);
              }}
              error={timeError}
              placeholder="08:00"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <Button
              variant="secondary"
              label={t('notifications.saveTime')}
              loading={update.isPending}
              disabled={time.trim() === saved}
              onPress={saveTime}
            />
          </View>
        </>
      ) : null}

      {device.state ? (
        <ListGroup title={t('notifications.thisDevice')}>
          {device.state === 'off' ? (
            <ListRow label={t('notifications.turnOn')} onPress={() => void device.enable()} />
          ) : null}
          {device.state === 'on' ? <ListRow label={t('notifications.onForDevice')} /> : null}
          {device.state === 'on' ? <ListRow label={t('notifications.turnOff')} onPress={() => void device.disable()} /> : null}
        </ListGroup>
      ) : null}
      {device.state === 'needs-install' ? (
        <KText variant="body" color="inkMuted">
          {t('notifications.needsInstall')}
        </KText>
      ) : null}
      {device.state === 'denied' ? (
        <KText variant="body" color="inkMuted">
          {t('notifications.denied')}
        </KText>
      ) : null}
      {device.state === 'unsupported' ? (
        <KText variant="body" color="inkMuted">
          {t('notifications.unsupported')}
        </KText>
      ) : null}
      {device.failed ? (
        <KText variant="body" color="brandStrong" accessibilityLiveRegion="polite">
          {t('notifications.deviceFailed')}
        </KText>
      ) : null}
    </Screen>
  );
}
