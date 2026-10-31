import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, TextField, tokens, useToast } from '@klindom/ui';
import { useAuth } from '../../src/auth/AuthProvider';

const CODE_LENGTH = 6;

export default function CodeScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { verifyEmailCode, sendEmailCode } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // On success the session changes and the auth gate takes the user onward.
  const verify = async () => {
    if (code.length !== CODE_LENGTH) return;
    setError(undefined);
    setBusy(true);
    try {
      await verifyEmailCode(email, code);
    } catch {
      setError(t('code.invalid'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await sendEmailCode(email);
      toast.show({ message: t('code.resent') });
    } catch {
      toast.show({ message: t('errors.generic') });
    }
  };

  return (
    <Screen title={t('code.title')}>
      <KText variant="body" color="inkMuted">
        {t('code.hint', { email })}
      </KText>
      <View style={{ gap: tokens.space[4] }}>
        <TextField
          label={t('code.label')}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          error={error}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          onSubmitEditing={verify}
        />
        <Button label={t('code.verify')} loading={busy} disabled={code.length !== CODE_LENGTH} onPress={verify} />
        <Button variant="chip" label={t('code.resend')} onPress={resend} />
      </View>
    </Screen>
  );
}
