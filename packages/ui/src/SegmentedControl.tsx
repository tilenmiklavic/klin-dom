import { Pressable, View } from 'react-native';
import { KText } from './Text';
import { tokens } from './tokens';

export interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: tokens.space[1],
        borderRadius: tokens.radius.pill,
        backgroundColor: tokens.color.surfaceSunken,
        boxShadow: tokens.shadow.inset,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.pill,
              backgroundColor: selected ? tokens.color.surfaceRaised : 'transparent',
              boxShadow: selected ? tokens.shadow.float : undefined,
            }}
          >
            <KText variant="button" color={selected ? 'ink' : 'inkMuted'}>
              {o.label}
            </KText>
          </Pressable>
        );
      })}
    </View>
  );
}
