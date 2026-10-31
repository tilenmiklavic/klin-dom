import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActionOrb, Button, KText, Screen, TextField, tokens, useToast } from '@klindom/ui';
import { useAuth } from '../../src/auth/AuthProvider';
import { getConfig } from '../../src/config';

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { signInWithGoogle, signInDev } = useAuth();
  const [busy, setBusy] = useState(false);
  const [devName, setDevName] = useState('Dev');
  const isDev = getConfig().authMode === 'dev';

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.show({ message: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.space[8], paddingTop: tokens.space[12] }}>
        <ActionOrb size="lg" halo icon="sparkle" label={t('welcome.orbLabel')} onPress={() => router.push('/(auth)/email')} />
        <KText variant="display" style={{ textAlign: 'center' }}>
          {t('welcome.greeting')}
        </KText>
        <View style={{ width: '100%', gap: tokens.space[3] }}>
          <Button label={t('welcome.google')} loading={busy} onPress={() => run(signInWithGoogle)} />
          <Button variant="secondary" label={t('welcome.email')} onPress={() => router.push('/(auth)/email')} />
          {isDev ? (
            <>
              <TextField label={t('welcome.devName')} value={devName} onChangeText={setDevName} autoCapitalize="words" />
              <Button variant="soft" label={t('welcome.devSignIn')} loading={busy} onPress={() => run(() => signInDev(devName))} />
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
