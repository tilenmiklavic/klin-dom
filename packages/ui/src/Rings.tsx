import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Ring, clamp01 } from './Ring';
import { KText } from './Text';
import { tokens, type ColorToken } from './tokens';

export interface RingsItem {
  key: string;
  label: string;
  value: number;
  total: number;
  unit?: string;
  color: ColorToken;
}

export interface RingsProps {
  rings: RingsItem[];
  size?: number;
  stroke?: number;
  onRingClosed?: (key: string) => void;
}

const GAP = 3;

const progressOf = (r: RingsItem) => (r.total === 0 ? 1 : clamp01(r.value / r.total));

export function Rings({ rings, size = 150, stroke = 16, onRingClosed }: RingsProps) {
  const previous = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    const before = previous.current;
    const next = new Map(rings.map((r) => [r.key, progressOf(r)]));
    if (before) {
      for (const [key, p] of next) {
        const was = before.get(key);
        if (was !== undefined && was < 1 && p >= 1) onRingClosed?.(key);
      }
    }
    previous.current = next;
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[4] }}>
      <View style={{ width: size, height: size }}>
        {rings.map((r, i) => {
          const inset = i * (stroke + GAP);
          const ringSize = size - 2 * inset;
          const closed = r.total === 0;
          return (
            <View key={r.key} style={{ position: 'absolute', top: inset, left: inset }}>
              <Ring
                progress={progressOf(r)}
                size={ringSize}
                stroke={stroke}
                color={r.color}
                accessibilityLabel={r.label}
                accessibilityValue={
                  closed ? { now: 1, max: 1 } : { now: r.value, max: r.total }
                }
              />
            </View>
          );
        })}
      </View>
      <View style={{ gap: tokens.space[5] }}>
        {rings.map((r) => (
          <View key={r.key} style={{ gap: tokens.space[1] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.color[r.color],
                }}
              />
              <KText variant="label" color="inkMuted">
                {r.label}
              </KText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingLeft: 20 }}>
              <KText variant="stat">{r.unit === '%' ? `${r.value}%` : String(r.value)}</KText>
              {r.unit === '%' ? null : (
                <KText variant="stat" color="inkMuted">{`/${r.total}`}</KText>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
