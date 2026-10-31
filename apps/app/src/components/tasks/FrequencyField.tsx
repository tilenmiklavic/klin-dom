import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChoiceChips, tokens } from '@klindom/ui';
import { Stepper } from '../Stepper';

type Unit = 'day' | 'week' | 'month';

/** "Every [− n +]" plus Day / Week / Month. */
export function FrequencyField({ count, unit, onChange }: { count: number; unit: Unit; onChange: (count: number, unit: Unit) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: tokens.space[3] }}>
      <Stepper
        label={t('editor.every')}
        value={count}
        min={1}
        max={365}
        fewerLabel={t('editor.fewer')}
        moreLabel={t('editor.more')}
        onChange={(n) => onChange(n, unit)}
      />
      <ChoiceChips<Unit>
        value={unit}
        options={(['day', 'week', 'month'] as const).map((u) => ({ value: u, label: t(`editor.${u}`) }))}
        onChange={(u) => onChange(count, u as Unit)}
      />
    </View>
  );
}
