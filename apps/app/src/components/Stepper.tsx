import { Pressable, View } from 'react-native';
import { KText, tokens } from '@klindom/ui';

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  fewerLabel: string;
  moreLabel: string;
  onChange: (value: number) => void;
}

const SIZE = 36;

/** A label with a − / + count control, in a raised card row. */
export function Stepper({ label, value, min, max, fewerLabel, moreLabel, onChange }: StepperProps) {
  const control = (text: string, accessibilityLabel: string, disabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: tokens.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.color.surfaceSunken,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <KText variant="button">{text}</KText>
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.space[4],
        paddingVertical: tokens.space[3],
        paddingHorizontal: tokens.space[4],
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.color.surfaceRaised,
        boxShadow: tokens.shadow.card,
      }}
    >
      <KText variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </KText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] }}>
        {control('−', fewerLabel, value <= min, value - 1)}
        <KText variant="heading" accessibilityLabel={String(value)} style={{ minWidth: 20, textAlign: 'center' }}>
          {value}
        </KText>
        {control('+', moreLabel, value >= max, value + 1)}
      </View>
    </View>
  );
}
