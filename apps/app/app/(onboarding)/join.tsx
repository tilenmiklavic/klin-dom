import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, TextField, tokens } from '@klindom/ui';
import { normalizeInviteCode } from '../../src/data/invites';

export default function JoinCode() {
  const { t } = useTranslation();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string>();

  const find = () => {
    const code = normalizeInviteCode(input);
    if (!code) return setError(t('join.codeRequired'));
    router.push({ pathname: '/join/[code]', params: { code } });
  };

  return (
    <Screen title={t('join.title')}>
      <KText variant="body" color="inkMuted">
        {t('join.hint')}
      </KText>
      <View style={{ gap: tokens.space[4] }}>
        <TextField
          label={t('join.codeLabel')}
          placeholder={t('join.codePlaceholder')}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            setError(undefined);
          }}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={find}
        />
        <Button label={t('join.find')} onPress={find} />
        <Button variant="chip" label={t('common.back')} onPress={() => router.replace('/(onboarding)/start')} />
      </View>
    </Screen>
  );
}
