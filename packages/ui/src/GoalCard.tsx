import { View } from 'react-native';
import { ActionOrb } from './ActionOrb';
import { KText } from './Text';
import { tokens } from './tokens';

export interface GoalCardProps {
  title: string;
  value: number;
  goal: number;
  unit?: string;
  actionLabel: string;
  onAction: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function GoalCard({ title, value, goal, unit, actionLabel, onAction }: GoalCardProps) {
  const pct = Math.max(0, Math.min(1, value / (goal || 1)));
  return (
    <View
      style={{
        gap: tokens.space[5],
        padding: tokens.space[5],
        maxWidth: 420,
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.color.surfaceSunken,
        boxShadow: tokens.shadow.inset,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: tokens.space[4],
        }}
      >
        <KText variant="heading" style={{ maxWidth: 220, flexShrink: 1 }}>
          {title}
        </KText>
        <ActionOrb label={actionLabel} onPress={onAction} />
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={title}
        accessibilityValue={{ min: 0, max: goal, now: value }}
        style={{
          height: 48,
          padding: 6,
          justifyContent: 'center',
          borderRadius: tokens.radius.pill,
          backgroundColor: tokens.color.track,
          boxShadow: tokens.shadow.inset,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            minWidth: 36,
            borderRadius: tokens.radius.pill,
            backgroundColor: tokens.color.surfaceRaised,
            boxShadow: tokens.shadow.float,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: tokens.space[5],
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <KText variant="label" style={{ fontFamily: tokens.type.heading.fontFamily }}>
            {fmt(value)}
            <KText variant="label" color="inkMuted">
              {`/${fmt(goal)}${unit ? ` ${unit}` : ''}`}
            </KText>
          </KText>
        </View>
      </View>
    </View>
  );
}
