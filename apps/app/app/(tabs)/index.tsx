import { useTranslation } from 'react-i18next';
import { Screen } from '@klindom/ui';

/** Placeholder: the Today screen lands in a later task. */
export default function Today() {
  const { t } = useTranslation();
  return <Screen title={t('tabs.today')}>{null}</Screen>;
}
