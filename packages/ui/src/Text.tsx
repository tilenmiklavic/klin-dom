import { Text, type TextProps } from 'react-native';
import { tokens, type ColorToken, type TypeVariant } from './tokens';

export interface KTextProps extends TextProps {
  variant: TypeVariant;
  color?: ColorToken;
}

export function KText({ variant, color = 'ink', style, ...rest }: KTextProps) {
  return <Text {...rest} style={[tokens.type[variant], { color: tokens.color[color] }, style]} />;
}
