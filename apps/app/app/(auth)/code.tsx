import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, TextField, tokens, useToast } from '@klindom/ui';
import { useAuth } from '../../src/auth/AuthProvider';

// Supabase's email OTP length is a project setting (6–10, default 8), so accept any of them.
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

export default function CodeScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { verifyEmailCode, sendEmailCode } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // On success the session changes and the auth gate takes the user onward.
  const complete = code.length >= MIN_CODE_LENGTH;

  const verify = async () => {
    if (!complete) return;
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
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH))}
          error={error}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={MAX_CODE_LENGTH}
          onSubmitEditing={verify}
        />
        <Button label={t('code.verify')} loading={busy} disabled={!complete} onPress={verify} />
        <Button variant="chip" label={t('code.resend')} onPress={resend} />
      </View>
    </Screen>
  );
}
