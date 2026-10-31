import { Pressable, View } from 'react-native';
import { KText } from './Text';
import { tokens } from './tokens';

export interface ChoiceChipsProps<T> {
  options: { value: T; label: string }[];
  value: T[] | T;
  multiple?: boolean;
  onChange: (value: T[] | T) => void;
}

export function ChoiceChips<T extends string | number>({
  options,
  value,
  multiple,
  onChange,
}: ChoiceChipsProps<T>) {
  const selectedValues: T[] = Array.isArray(value) ? value : [value];
  return (
    <View
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] }}
    >
      {options.map((o) => {
        const selected = selectedValues.includes(o.value);
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={o.label}
            accessibilityState={multiple ? { checked: selected } : { selected }}
            onPress={() => {
              if (!multiple) return onChange(o.value);
              onChange(
                selected ? selectedValues.filter((v) => v !== o.value) : [...selectedValues, o.value],
              );
            }}
            style={{
              height: 36,
              paddingHorizontal: tokens.space[4],
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.pill,
              backgroundColor: selected ? tokens.color.ink : tokens.color.surfaceSunken,
            }}
          >
            <KText
              variant="button"
              color={selected ? 'onNight' : 'ink'}
              style={{ fontFamily: tokens.type.heading.fontFamily, fontWeight: '500' }}
            >
              {o.label}
            </KText>
          </Pressable>
        );
      })}
    </View>
  );
}
