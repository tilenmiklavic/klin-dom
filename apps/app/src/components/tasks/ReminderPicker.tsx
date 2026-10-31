import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { reminderPresets } from '@klindom/shared';
import { ChoiceChips, KText, tokens } from '@klindom/ui';
import { MAX_REMINDERS, normalizeKeys, offsetsFromKeys, type ReminderKey } from '../../tasks/reminders';

interface Props {
  value: ReminderKey[];
  dueTime: string | null;
  extraOffsets: number[];
  onChange: (keys: ReminderKey[]) => void;
}

/** Reminder presets; further ones are refused once the saved list would hold the maximum. */
export function ReminderPicker({ value, dueTime, extraOffsets, onChange }: Props) {
  const { t } = useTranslation();
  const count = offsetsFromKeys(value, dueTime, extraOffsets).length;
  return (
    <View style={{ gap: tokens.space[2] }}>
      <ChoiceChips<ReminderKey>
        multiple
        value={value}
        options={reminderPresets.map((p) => ({ value: p.key, label: t(`reminders.${p.key}`) }))}
        onChange={(v) => {
          const next = normalizeKeys(v as ReminderKey[], dueTime);
          if (offsetsFromKeys(next, dueTime, extraOffsets).length > MAX_REMINDERS) return;
          onChange(next);
        }}
      />
      {count >= MAX_REMINDERS ? (
        <KText variant="caption" color="inkMuted" style={{ paddingHorizontal: tokens.space[2] }}>
          {t('editor.reminderLimit', { count: MAX_REMINDERS })}
        </KText>
      ) : null}
    </View>
  );
}
