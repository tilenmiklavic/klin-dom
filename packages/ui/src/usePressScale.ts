import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export function usePressScale(pressedScale: number) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withTiming(pressedScale, { duration: 90 });
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: 140 });
    },
  };
}
