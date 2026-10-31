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
  const press = usePressScale();
  const { orb, icon: iconSize } = dims[size];
  const ring1 = orb + tokens.space[4];
  const ring2 = orb + tokens.space[8];
  const outer = halo ? ring2 : orb;
  return (
    <View
      style={{
        width: outer,
        height: outer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {halo ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: ring2,
              height: ring2,
              borderRadius: ring2 / 2,
              backgroundColor: tokens.color.brandHalo,
              opacity: 0.4,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: ring1,
              height: ring1,
              borderRadius: ring1 / 2,
              backgroundColor: tokens.color.brandHalo,
              opacity: 0.7,
            }}
          />
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
