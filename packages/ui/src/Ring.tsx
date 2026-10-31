import { useEffect } from 'react';
import { View, type AccessibilityValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { tokens, type ColorToken } from './tokens';

export interface RingProps {
  progress: number;
  size: number;
  stroke: number;
  color: ColorToken;
  accessibilityLabel?: string;
  accessibilityValue?: AccessibilityValue;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function Ring({
  progress,
  size,
  stroke,
  color,
  accessibilityLabel,
  accessibilityValue,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = clamp01(progress);
  const shown = useSharedValue(target);

  useEffect(() => {
    shown.value = withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [target, shown]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [c * shown.value, c],
  }));

  const labelled = accessibilityLabel !== undefined;
  return (
    <View
      accessible={labelled}
      accessibilityRole={labelled ? 'progressbar' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={accessibilityValue ?? { now: target, max: 1 }}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tokens.color.track}
          strokeWidth={stroke}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tokens.color[color]}
          strokeWidth={stroke}
          strokeLinecap="round"
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
