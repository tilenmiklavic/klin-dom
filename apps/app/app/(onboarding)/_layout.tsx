import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBootstrap } from '../../src/data/homes';
import { OnboardingDraftProvider } from '../../src/state/onboardingDraft';

export default function OnboardingLayout() {
  const { t } = useTranslation();
  const firstName = useBootstrap().data?.user.displayName?.trim().split(/\s+/)[0];
  const defaultName = firstName ? t('create.defaultName', { name: firstName }) : t('create.defaultNameFallback');
  return (
    <OnboardingDraftProvider defaultName={defaultName}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </OnboardingDraftProvider>
  );
}
