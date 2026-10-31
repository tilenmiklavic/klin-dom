import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, ListGroup, ListRow, Screen, Sheet, TextField, tokens, useToast } from '@klindom/ui';
import { apiErrorText } from '../../../src/errors/apiErrorText';
import { useDeleteHome, useHome, useLeaveHome, useRefreshBootstrap, useUpdateHome } from '../../../src/data/homes';
import { currentHomeStore, useCurrentHome } from '../../../src/state/currentHome';

type Confirm = 'leave' | 'delete' | null;

export default function HomeSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const update = useUpdateHome(homeId);
  const leave = useLeaveHome(homeId);
  const del = useDeleteHome(homeId);
  const refreshHomes = useRefreshBootstrap();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [typed, setTyped] = useState('');
  const isOwner = home.data?.role === 'owner';
  const homeName = home.data?.name ?? '';

  useEffect(() => {
    setName(homeName);
  }, [homeName]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('profile.nameRequired'));
      return;
    }
    try {
      await update.mutateAsync(trimmed);
    } catch {
      toast.show({ message: t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t('profile.homeSaved') });
  };

  /** The home is gone for this user: forget it and let the auth gate pick where they belong. */
  const goneFromHome = async (message: string) => {
    currentHomeStore.clear();
    await refreshHomes();
    toast.show({ message });
    router.replace('/profile');
  };

  const doLeave = async () => {
    setConfirm(null);
    try {
      await leave.mutateAsync();
    } catch (e) {
      toast.show({ message: apiErrorText(t, e, { fallback: 'errors.saveFailed' }) });
      return;
    }
    await goneFromHome(t('profile.left', { home: homeName }));
  };

  const doDelete = async () => {
    if (typed !== homeName) return;
    setConfirm(null);
    try {
      await del.mutateAsync(typed);
    } catch (e) {
      toast.show({ message: apiErrorText(t, e, { fallback: 'errors.saveFailed' }) });
      return;
    }
    await goneFromHome(t('profile.homeDeleted', { home: homeName }));
  };

  return (
    <Screen title={t('profile.homeTitle')} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      {home.data ? (
        <>
          {isOwner ? (
            <View style={{ gap: tokens.space[3] }}>
              <TextField
                label={t('profile.homeName')}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setNameError(undefined);
                }}
                error={nameError}
                maxLength={60}
              />
              <Button
                variant="secondary"
                label={t('profile.saveName')}
                loading={update.isPending}
                disabled={name.trim() === homeName}
                onPress={() => void saveName()}
              />
            </View>
          ) : null}
          <ListGroup>
            <ListRow label={t('profile.leave')} destructive onPress={() => setConfirm('leave')} />
            {isOwner
              ? [
                  <ListRow
                    key="delete"
                    label={t('profile.deleteHome')}
                    destructive
                    onPress={() => {
                      setTyped('');
                      setConfirm('delete');
                    }}
                  />,
                ]
              : []}
          </ListGroup>
        </>
      ) : null}

      <Sheet
        visible={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        title={t('profile.leaveTitle', { home: homeName })}
        closeLabel={t('common.close')}
      >
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {t('profile.leaveBody')}
          </KText>
          <Button label={t('profile.leave')} loading={leave.isPending} onPress={() => void doLeave()} />
          <Button variant="secondary" label={t('profile.keep')} onPress={() => setConfirm(null)} />
        </View>
      </Sheet>

      <Sheet
        visible={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title={t('profile.deleteHomeTitle', { home: homeName })}
        closeLabel={t('common.close')}
      >
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {t('profile.deleteHomeBody')}
          </KText>
          <TextField label={t('profile.homeName')} value={typed} onChangeText={setTyped} placeholder={homeName} autoCapitalize="none" />
          <Button label={t('profile.deleteHome')} loading={del.isPending} disabled={typed !== homeName} onPress={() => void doDelete()} />
          <Button variant="secondary" label={t('profile.keep')} onPress={() => setConfirm(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}
