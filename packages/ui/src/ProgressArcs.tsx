import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { KText } from './Text';
import { tokens } from './tokens';

export interface ProgressArcsItem {
  label: string;
  value: number;
  goal: number;
  unit?: string;
  tone?: 'brand' | 'ink';
}

export interface ProgressArcsProps {
  items: ProgressArcsItem[];
}

const R = 120;
const STROKE = 9;

function arc(r: number, frac: number) {
  const a = (frac * Math.PI) / 2;
  const x = r * Math.sin(a);
  const y = r - r * Math.cos(a);
  return `M 0 0 A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

export function ProgressArcs({ items }: ProgressArcsProps) {
  const toneOf = (it: ProgressArcsItem, i: number) => it.tone ?? (i === 0 ? 'brand' : 'ink');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: tokens.space[4],
        padding: tokens.space[3],
        maxWidth: 460,
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.color.surfaceSunken,
        boxShadow: tokens.shadow.inset,
      }}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'flex-end', overflow: 'hidden' }}
      >
        <Svg viewBox={`-8 -8 ${R + 16} ${R + 16}`} width={170} height={170}>
          {items.map((it, i) => {
            const r = R - i * 22;
            const f = Math.max(0, Math.min(1, it.value / (it.goal || 1)));
            return (
              <G key={i} transform={`translate(0 ${R - r})`}>
                <Path
                  d={arc(r, 1)}
                  fill="none"
                  stroke={tokens.color.track}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                />
                {f > 0 ? (
                  <Path
                    d={arc(r, f)}
                    fill="none"
                    stroke={tokens.color[toneOf(it, i)]}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                  />
                ) : null}
              </G>
            );
          })}
        </Svg>
      </View>
      <View
        style={{
          gap: tokens.space[5],
          padding: tokens.space[5],
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.surfaceRaised,
          boxShadow: tokens.shadow.card,
        }}
      >
        {items.map((it, i) => (
          <View key={i} style={{ gap: tokens.space[1] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: tokens.color[toneOf(it, i)],
                }}
              />
              <KText variant="label" color="inkMuted">
                {it.label}
              </KText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingLeft: 20 }}>
              <KText variant="stat">{`${it.value}/${it.goal}`}</KText>
              {it.unit ? (
                <KText
                  variant="body"
                  style={{ marginLeft: 2, fontFamily: tokens.type.stat.fontFamily }}
                >
                  {it.unit}
                </KText>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
