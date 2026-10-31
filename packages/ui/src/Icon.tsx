import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { IconName } from '@klindom/shared';
import { icons } from './icons';
import { tokens, type ColorToken } from './tokens';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorToken;
  title?: string;
}

export function Icon({ name, size = 20, color = 'ink', title }: IconProps) {
  const fill = tokens.color[color];
  // The a11y props live on a wrapper: react-native-svg forwards unknown props to the DOM <svg> on web.
  return (
    <View
      accessible={title !== undefined}
      accessibilityLabel={title}
      accessibilityRole={title ? 'image' : undefined}
      importantForAccessibility={title ? 'yes' : 'no-hide-descendants'}
      style={{ width: size, height: size }}
    >
      <Svg viewBox="0 0 24 24" width={size} height={size} fill={fill}>
        {icons[name].map((p, i) => (
          <Path key={i} d={p.d} fill={fill} fillRule={p.fillRule} />
        ))}
      </Svg>
    </View>
  );
}
