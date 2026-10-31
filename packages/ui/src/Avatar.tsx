import { View } from 'react-native';
import { KText } from './Text';
import { tokens } from './tokens';

export interface AvatarProps {
  name: string | null;
  size?: number;
  tone?: 'night' | 'muted';
}

export function Avatar({ name, size = 22, tone = 'night' }: AvatarProps) {
  const initial = name ? (Array.from(name.trim())[0] ?? '?').toUpperCase() : '?';
  const night = tone === 'night';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: night ? tokens.color.night : tokens.color.surfaceSunken,
      }}
    >
      <KText
        variant="caption"
        color={night ? 'onNight' : 'inkMuted'}
        style={{
          fontFamily: tokens.type.heading.fontFamily,
          fontWeight: '500',
          fontSize: Math.round(size * 0.5),
          lineHeight: Math.round(size * 0.5) + 2,
        }}
      >
        {initial}
      </KText>
    </View>
  );
}
