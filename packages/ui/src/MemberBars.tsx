import { View } from 'react-native';
import { KText } from './Text';
import { tokens } from './tokens';

export interface MemberBarsProps {
  rows: { name: string; value: number }[];
}

const BAR_HEIGHT = 84;

export function MemberBars({ rows }: MemberBarsProps) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: tokens.space[4] }}>
      {rows.map((row, i) => (
        <View
          key={`${row.name}-${i}`}
          accessible
          accessibilityLabel={`${row.name}: ${row.value}`}
          style={{ alignItems: 'center', gap: tokens.space[2], flexShrink: 1 }}
        >
          <KText variant="label" style={{ fontFamily: tokens.type.heading.fontFamily }}>
            {String(row.value)}
          </KText>
          <View
            style={{
              width: 8,
              height: BAR_HEIGHT,
              justifyContent: 'flex-end',
              overflow: 'hidden',
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.color.track,
            }}
          >
            <View
              testID={`member-bar-fill-${i}`}
              style={{
                height: `${(Math.max(0, row.value) / max) * 100}%`,
                borderRadius: tokens.radius.pill,
                backgroundColor: i === 0 ? tokens.color.brand : tokens.color.ink,
              }}
            />
          </View>
          <KText variant="caption" color="inkMuted" numberOfLines={1}>
            {row.name}
          </KText>
        </View>
      ))}
    </View>
  );
}
