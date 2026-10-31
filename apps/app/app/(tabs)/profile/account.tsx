import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@klindom/shared';
import { Button, KText, ListGroup, ListRow, Screen, Sheet, TextField, tokens, useToast } from '@klindom/ui';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useBootstrap, useDeleteMe, useUpdateMe } from '../../../src/data/homes';

export default function Account() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useAuth();
  const current = useBootstrap().data?.user.displayName ?? '';
  const update = useUpdateMe();
  const del = useDeleteMe();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);

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
    setConfirming(false);
    try {
      await del.mutateAsync();
    } catch (e) {
      toast.show({ message: e instanceof ApiError && e.code === 'transfer_required' ? t('profile.transferRequired') : t('errors.saveFailed') });
      return;
    }
    // Signing out clears the session, the cached data and the chosen home; the auth gate shows Welcome.
    await signOut();
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
        <ListRow label={t('profile.signOut')} onPress={() => void signOut()} />
        <ListRow label={t('profile.deleteAccount')} destructive onPress={() => setConfirming(true)} />
      </ListGroup>

      <Sheet visible={confirming} onClose={() => setConfirming(false)} title={t('profile.deleteAccountTitle')} closeLabel={t('common.close')}>
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {t('profile.deleteAccountBody')}
          </KText>
          <Button label={t('profile.deleteAccount')} loading={del.isPending} onPress={() => void doDelete()} />
          <Button variant="secondary" label={t('profile.keep')} onPress={() => setConfirming(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
