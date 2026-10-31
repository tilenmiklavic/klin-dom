import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, Screen, tokens } from '@klindom/ui';

export default function Start() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen title={t('onboarding.title')}>
      <KText variant="body" color="inkMuted">
        {t('onboarding.hint')}
      </KText>
      <View style={{ gap: tokens.space[3] }}>
        <Button label={t('onboarding.create')} onPress={() => router.push('/(onboarding)/create')} />
        <Button variant="secondary" label={t('onboarding.join')} onPress={() => router.push('/(onboarding)/join')} />
      </View>
    </Screen>
  );
}
