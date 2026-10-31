import { useTranslation } from 'react-i18next';
import { Screen } from '@klindom/ui';

/** Placeholder: the task detail screen lands in a later task. */
export default function TaskDetail() {
  const { t } = useTranslation();
  return <Screen title={t('tabs.tasks')}>{null}</Screen>;
}
