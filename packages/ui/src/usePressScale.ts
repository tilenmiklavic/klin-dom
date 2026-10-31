import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export const PRESS_SCALE = 0.97;

export function usePressScale() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return {
    style,
    onPressIn: () => {
      scale.value = withTiming(PRESS_SCALE, { duration: 90 });
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: 140 });
    },
  };
}
