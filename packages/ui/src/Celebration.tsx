import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Icon } from './Icon';

export interface CelebrationProps {
  visible: boolean;
  onDone: () => void;
}

const DURATION_MS = 900;
const COUNT = 8;
const DISTANCE = 90;

function Spark({ angle, progress }: { angle: number; progress: { value: number } }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * DISTANCE * progress.value },
      { translateY: Math.sin(angle) * DISTANCE * progress.value },
      { scale: 0.4 + 0.8 * (1 - progress.value) },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute' }, style]}>
      <Icon name="sparkle" size={22} color="brand" />
    </Animated.View>
  );
}

export function Celebration({ visible, onDone }: CelebrationProps) {
  const progress = useSharedValue(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!visible) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = setTimeout(() => done.current(), DURATION_MS);
    return () => clearTimeout(id);
  }, [visible, progress]);

  if (!visible) return null;
  return (
    <View
      testID="celebration"
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      {Array.from({ length: COUNT }, (_, i) => (
        <Spark key={i} angle={(i / COUNT) * Math.PI * 2} progress={progress} />
      ))}
    </View>
  );
}
