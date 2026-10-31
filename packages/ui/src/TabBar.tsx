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
        padding: tokens.space[2],
        borderRadius: tokens.radius.pill,
        backgroundColor: tokens.color.night,
        boxShadow: tokens.shadow.float,
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
              height: 44,
              minWidth: 44,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.space[2],
              paddingHorizontal: selected ? tokens.space[4] : tokens.space[3],
              borderRadius: tokens.radius.pill,
              backgroundColor: selected ? tokens.color.surfaceRaised : 'transparent',
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
