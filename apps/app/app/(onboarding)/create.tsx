import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, ListGroup, ListRow, Screen, TextField, tokens } from '@klindom/ui';
import { useCreateHomeFlow } from '../../src/onboarding/useCreateHomeFlow';
import { useOnboardingDraft } from '../../src/state/onboardingDraft';

export default function Create() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingDraft();
  const [error, setError] = useState<string>();
  const create = useCreateHomeFlow();

  const valid = () => {
    if (!draft.name.trim()) {
      setError(t('create.nameRequired'));
      return false;
    }
    setError(undefined);
    return true;
  };

  return (
    <Screen title={t('create.title')}>
      <KText variant="body" color="inkMuted">
        {t('create.hint')}
      </KText>
      <View style={{ gap: tokens.space[4] }}>
        <TextField
          label={t('create.nameLabel')}
          value={draft.name}
          onChangeText={(text) => {
            draft.setName(text);
            setError(undefined);
          }}
          error={error}
          maxLength={60}
        />
        <ListGroup>
          <ListRow label={t('create.timezone')} value={draft.timezone} />
        </ListGroup>
        <Button
          label={t('create.withSuggestions')}
          disabled={create.isPending}
          onPress={() => valid() && router.push('/(onboarding)/rooms')}
        />
        <Button
          variant="secondary"
          label={t('create.fromScratch')}
          loading={create.isPending}
          onPress={() => valid() && create.mutate({ name: draft.name.trim(), timezone: draft.timezone })}
        />
      </View>
    </Screen>
  );
}
