import { useTranslation } from 'react-i18next';
import { reminderPresets } from '@klindom/shared';
import { ChoiceChips } from '@klindom/ui';
import type { ReminderKey } from '../../tasks/reminders';

export function ReminderPicker({ value, onChange }: { value: ReminderKey[]; onChange: (keys: ReminderKey[]) => void }) {
  const { t } = useTranslation();
  return (
    <ChoiceChips<ReminderKey>
      multiple
      value={value}
      options={reminderPresets.map((p) => ({ value: p.key, label: t(`reminders.${p.key}`) }))}
      onChange={(v) => onChange(v as ReminderKey[])}
    />
  );
}
