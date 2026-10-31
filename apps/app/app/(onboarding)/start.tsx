import { useTranslation } from 'react-i18next';
import { Screen } from '@klindom/ui';

/** Placeholder: the onboarding flow lands in a later task. */
export default function Start() {
  const { t } = useTranslation();
  return <Screen title={t('onboarding.title')}>{null}</Screen>;
}
