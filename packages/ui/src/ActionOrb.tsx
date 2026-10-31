import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { tokens } from './tokens';
import { usePressScale } from './usePressScale';

export type OrbSize = 'sm' | 'md' | 'lg';

export interface ActionOrbProps {
  size?: OrbSize;
  icon?: IconName;
  label: string;
  onPress: () => void;
  halo?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const dims: Record<OrbSize, { orb: number; icon: number }> = {
  sm: { orb: 40, icon: 18 },
  md: { orb: 56, icon: 24 },
  lg: { orb: 72, icon: 28 },
};

export function ActionOrb({ size = 'md', icon = 'sparkle', label, onPress, halo }: ActionOrbProps) {
  const press = usePressScale(0.94);
  const { orb, icon: iconSize } = dims[size];
  // Design system halo: surface pad (18), brandHalo ring (14), brandHaloFaint ring (to 30).
  const pad = 18;
  const ringNear = 14;
  const ringFar = 30;
  const padded = orb + pad * 2;
  const outer = halo ? padded + ringFar * 2 : orb;
  const disc = (diameter: number, color: string) => ({
    position: 'absolute' as const,
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: color,
  });
  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {halo ? (
        <>
          <View
            pointerEvents="none"
            style={disc(padded + ringFar * 2, tokens.color.brandHaloFaint)}
          />
          <View pointerEvents="none" style={disc(padded + ringNear * 2, tokens.color.brandHalo)} />
          <View pointerEvents="none" style={disc(padded, tokens.color.surface)} />
        </>
      ) : null}
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          {
            width: orb,
            height: orb,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.color.brand,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: tokens.shadow.glow,
          },
          press.style,
        ]}
      >
        <Icon name={icon} size={iconSize} color="onBrand" />
      </AnimatedPressable>
    </View>
  );
}
