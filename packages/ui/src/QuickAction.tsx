import { Pressable, View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { KText } from './Text';
import { tokens } from './tokens';

export interface QuickActionProps {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 72,
        alignItems: 'center',
        gap: tokens.space[3],
        paddingTop: 10,
        paddingBottom: tokens.space[4],
        borderRadius: tokens.radius.pill,
        backgroundColor: tokens.color.surfaceSunken,
        boxShadow: tokens.shadow.inset,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: tokens.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.surfaceRaised,
          boxShadow: tokens.shadow.float,
        }}
      >
        <Icon name={icon} size={22} />
      </View>
      <KText variant="caption" color="inkMuted" numberOfLines={1}>
        {label}
      </KText>
    </Pressable>
  );
}
