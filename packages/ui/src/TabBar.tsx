import { useEffect, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { KText } from './Text';
import { tokens } from './tokens';

export interface TabBarProps {
  items: { id: string; label: string; icon: IconName }[];
  active: string;
  onChange: (id: string) => void;
}

// Shared by the sliding pill and the tabs' own width change so they move as one.
const SPRING = { damping: 20, stiffness: 220, mass: 0.9 };
const tabLayout = LinearTransition.springify()
  .damping(SPRING.damping)
  .stiffness(SPRING.stiffness)
  .mass(SPRING.mass);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Box = { x: number; width: number };

export function TabBar({ items, active, onChange }: TabBarProps) {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const placed = useRef(false);

  const target = boxes[active];
  useEffect(() => {
    if (!target) return;
    if (!placed.current) {
      // First measurement: put the pill in place without animating in from x=0.
      placed.current = true;
      pillX.value = target.x;
      pillWidth.value = target.width;
      pillOpacity.value = withTiming(1, { duration: 150 });
      return;
    }
    pillX.value = withSpring(target.x, SPRING);
    pillWidth.value = withSpring(target.width, SPRING);
  }, [target?.x, target?.width]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    width: pillWidth.value,
    transform: [{ translateX: pillX.value }],
  }));

  const onTabLayout = (id: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setBoxes((prev) =>
      prev[id]?.x === x && prev[id]?.width === width ? prev : { ...prev, [id]: { x, width } },
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.space[2],
        padding: 6,
        borderRadius: tokens.radius.pill,
        backgroundColor: tokens.color.night,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 6,
            left: 0,
            height: 52,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.color.surfaceRaised,
            boxShadow: tokens.shadow.float,
          },
          pillStyle,
        ]}
      />
      {items.map((item) => (
        <Tab
          key={item.id}
          item={item}
          selected={item.id === active}
          onPress={() => onChange(item.id)}
          onLayout={onTabLayout(item.id)}
        />
      ))}
    </View>
  );
}

function Tab({
  item,
  selected,
  onPress,
  onLayout,
}: {
  item: TabBarProps['items'][number];
  selected: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  // Inactive tabs sit on a grey disc; the selected one fades it out to reveal the sliding pill.
  const disc = useSharedValue(selected ? 0 : 1);
  useEffect(() => {
    disc.value = withTiming(selected ? 0 : 1, { duration: selected ? 120 : 220 });
  }, [selected]);
  const discStyle = useAnimatedStyle(() => ({ opacity: disc.value }));

  return (
    <AnimatedPressable
      layout={tabLayout}
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 52,
        minWidth: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.space[2],
        paddingLeft: selected ? tokens.space[5] : 0,
        paddingRight: selected ? tokens.space[6] : 0,
        borderRadius: tokens.radius.pill,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.color.nightRaised,
          },
          discStyle,
        ]}
      />
      <Icon name={item.icon} size={22} color={selected ? 'brand' : 'onNightMuted'} />
      {selected ? (
        <Animated.View entering={FadeIn.duration(180).delay(90)} exiting={FadeOut.duration(90)}>
          <KText variant="button" color="ink">
            {item.label}
          </KText>
        </Animated.View>
      ) : null}
    </AnimatedPressable>
  );
}
