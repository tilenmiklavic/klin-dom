import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { KText } from './Text';
import { tokens, type ColorToken } from './tokens';
import { usePressScale } from './usePressScale';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'chip';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const look: Record<ButtonVariant, { bg: string; fg: ColorToken; shadow?: string }> = {
  primary: {
    bg: tokens.color.brand,
    fg: 'onBrand',
    shadow: tokens.shadow.glow,
  },
  secondary: { bg: tokens.color.night, fg: 'onNight' },
  soft: {
    bg: tokens.color.surfaceRaised,
    fg: 'ink',
    shadow: tokens.shadow.float,
  },
  chip: { bg: tokens.color.surfaceSunken, fg: 'ink' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  label,
  onPress,
  disabled,
  loading,
}: ButtonProps) {
  const press = usePressScale();
  const inactive = !!disabled || !!loading;
  const { bg, fg, shadow } = look[variant];
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          height: size === 'md' ? 48 : 36,
          paddingHorizontal: size === 'md' ? tokens.space[6] : tokens.space[4],
          borderRadius: tokens.radius.pill,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.space[2],
          opacity: disabled ? 0.5 : 1,
          boxShadow: shadow,
        },
        press.style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
      <KText variant="button" color={fg} style={{ opacity: loading ? 0.6 : 1 }}>
        {label}
      </KText>
    </AnimatedPressable>
  );
}
