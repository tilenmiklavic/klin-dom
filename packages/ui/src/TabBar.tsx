import { Pressable, View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { KText } from './Text';
import { tokens } from './tokens';

export interface TabBarProps {
  items: { id: string; label: string; icon: IconName }[];
  active: string;
  onChange: (id: string) => void;
}

export function TabBar({ items, active, onChange }: TabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.space[2],
        padding: 6,
        borderRadius: tokens.radius.pill,
        backgroundColor: tokens.color.night,
      }}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.id)}
            style={{
              height: 52,
              minWidth: 52,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.space[2],
              paddingLeft: selected ? tokens.space[5] : 0,
              paddingRight: selected ? tokens.space[6] : 0,
              borderRadius: tokens.radius.pill,
              backgroundColor: selected ? tokens.color.surfaceRaised : tokens.color.nightRaised,
              boxShadow: selected ? tokens.shadow.float : undefined,
            }}
          >
            <Icon name={item.icon} size={22} color={selected ? 'brand' : 'onNightMuted'} />
            {selected ? (
              <KText variant="button" color="ink">
                {item.label}
              </KText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
