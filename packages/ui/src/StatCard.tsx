import { View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { Ring } from './Ring';
import { KText } from './Text';
import { tokens } from './tokens';

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  tone?: 'light' | 'night';
  icon?: IconName;
  large?: boolean;
  chart?: 'none' | 'ring' | 'bars';
  /** 0..1, for chart="ring". */
  progress?: number;
  /** Raw values, for chart="bars". */
  bars?: number[];
}

export function StatCard({
  label,
  value,
  unit,
  tone = 'light',
  icon,
  large,
  chart = 'none',
  progress = 0,
  bars = [],
}: StatCardProps) {
  const night = tone === 'night';
  const max = Math.max(1, ...bars);
  return (
    <View
      testID="stat-card"
      style={{
        flexDirection: chart === 'bars' ? 'column' : 'row',
        alignItems: chart === 'bars' ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: tokens.space[4],
        minWidth: 150,
        padding: tokens.space[5],
        borderRadius: tokens.radius.md,
        backgroundColor: night ? tokens.color.night : tokens.color.surfaceRaised,
        boxShadow: tokens.shadow.card,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        {icon ? (
          <View
            style={{
              width: 32,
              height: 32,
              marginBottom: tokens.space[3],
              borderRadius: tokens.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: night ? tokens.color.nightRaised : tokens.color.surfaceSunken,
            }}
          >
            <Icon name={icon} size={18} color={night ? 'onNight' : 'ink'} />
          </View>
        ) : null}
        <KText
          variant="label"
          color={night ? 'onNightMuted' : 'inkMuted'}
          style={{ marginBottom: tokens.space[1] }}
        >
          {label}
        </KText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <KText variant={large ? 'statLg' : 'stat'} color={night ? 'onNight' : 'ink'}>
            {value}
          </KText>
          {unit ? (
            <KText
              variant="body"
              color={night ? 'onNight' : 'ink'}
              style={{ marginLeft: 2, fontFamily: tokens.type.stat.fontFamily }}
            >
              {unit}
            </KText>
          ) : null}
        </View>
      </View>
      {chart === 'ring' ? <Ring progress={progress} size={48} stroke={4} color="ink" /> : null}
      {chart === 'bars' ? (
        <View
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', gap: tokens.space[2], height: 84 }}
        >
          {bars.map((v, i) => (
            <View
              key={i}
              style={{
                width: 4,
                justifyContent: 'flex-end',
                overflow: 'hidden',
                borderRadius: tokens.radius.pill,
                backgroundColor: night ? tokens.color.nightRaised : tokens.color.track,
              }}
            >
              <View
                style={{
                  height: `${(v / max) * 100}%`,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: night ? tokens.color.onNight : tokens.color.ink,
                }}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
