import { useTranslation } from 'react-i18next';
import { Screen } from '@klindom/ui';

/** Placeholder: this tab lands in a later task. */
export default function Tasks() {
  const { t } = useTranslation();
  return <Screen title={t('tabs.tasks')}>{null}</Screen>;
}
