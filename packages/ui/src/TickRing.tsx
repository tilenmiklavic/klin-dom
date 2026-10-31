import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
import { tokens } from './tokens';

export interface TickRingProps {
  done: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

const SIZE = 30;
const STROKE = 3;

export function TickRing({ done, onPress, disabled, accessibilityLabel }: TickRingProps) {
  const r = (SIZE - STROKE) / 2;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: done, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={7}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={{ width: SIZE, height: SIZE }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill={done ? tokens.color.brand : 'none'}
          stroke={done ? tokens.color.brand : tokens.color.track}
          strokeWidth={STROKE}
        />
        {done ? (
          <Path
            d="M9.5 15.5 13.5 19.5 21 11"
            fill="none"
            stroke={tokens.color.ink}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </Pressable>
  );
}
