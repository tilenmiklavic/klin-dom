import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, TextField, tokens } from '@klindom/ui';
import { useAuth } from '../../src/auth/AuthProvider';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sendEmailCode } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const address = email.trim();
    if (!EMAIL.test(address)) return setError(t('email.invalid'));
    setError(undefined);
    setBusy(true);
    try {
      await sendEmailCode(address);
      router.push({ pathname: '/(auth)/code', params: { email: address } });
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('email.title')}>
      <KText variant="body" color="inkMuted">
        {t('email.hint')}
      </KText>
      <View style={{ gap: tokens.space[4] }}>
        <TextField
          label={t('email.label')}
          placeholder={t('email.placeholder')}
          value={email}
          onChangeText={setEmail}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          textContentType="emailAddress"
          onSubmitEditing={send}
        />
        <Button label={t('email.send')} loading={busy} onPress={send} />
      </View>
    </Screen>
  );
}
