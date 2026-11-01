import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, ListGroup, ListRow, Screen, Sheet, TextField, tokens, useToast } from '@klindom/ui';
import { useAuth } from '../../../src/auth/AuthProvider';
import { apiErrorText } from '../../../src/errors/apiErrorText';
import { useBootstrap, useDeleteMe, useUpdateMe } from '../../../src/data/homes';
import { useForgetDevicePush, useSignOut } from '../../../src/push/usePush';

export default function Account() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const signOutDevice = useSignOut();
  const forgetDevicePush = useForgetDevicePush();
  const current = useBootstrap().data?.user.displayName ?? '';
  const update = useUpdateMe();
  const del = useDeleteMe();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const deleting = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(current);
  }, [current]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('profile.nameEmpty'));
      return;
    }
    try {
      await update.mutateAsync(trimmed);
    } catch {
      toast.show({ message: t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t('profile.nameSaved') });
  };

  const doDelete = async () => {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    // Nothing else may call the API with the still-valid token between the delete and the sign-out
    // (the API would create the user again): stop what is in flight and pause polling and refetches.
    onlineManager.setOnline(false);
    try {
      await queryClient.cancelQueries();
      // Before the delete: afterwards the API must not be called with this token again.
      await forgetDevicePush();
      await del.mutateAsync();
      // Signing out clears the session, the cached data and the chosen home; the auth gate shows Welcome.
      await signOut();
    } catch (e) {
      setConfirming(false); // a toast hides beneath an open sheet
      toast.show({ message: apiErrorText(t, e, { fallback: 'errors.saveFailed' }) });
    } finally {
      onlineManager.setOnline(true);
      deleting.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen title={t('profile.accountTitle')} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      <View style={{ gap: tokens.space[3] }}>
        <TextField
          label={t('profile.displayName')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(undefined);
          }}
          error={error}
          maxLength={40}
        />
        <Button
          variant="secondary"
          label={t('profile.saveName')}
          loading={update.isPending}
          disabled={name.trim() === current}
          onPress={() => void saveName()}
        />
      </View>
      <ListGroup>
        <ListRow label={t('profile.signOut')} onPress={() => void signOutDevice()} />
        <ListRow label={t('profile.deleteAccount')} destructive onPress={() => setConfirming(true)} />
      </ListGroup>

      <Sheet visible={confirming} onClose={() => !busy && setConfirming(false)} title={t('profile.deleteAccountTitle')} closeLabel={t('common.close')}>
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {t('profile.deleteAccountBody')}
          </KText>
          <Button label={t('profile.deleteAccount')} loading={busy} onPress={() => void doDelete()} />
          <Button variant="secondary" label={t('profile.keep')} disabled={busy} onPress={() => setConfirming(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
