import { View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { Ring } from './Ring';
import { KText } from './Text';
import { tokens } from './tokens';

export interface TaskChipProps {
  icon?: IconName;
  label: string;
  value: string;
  progress: number;
  done?: boolean;
}

export function TaskChip({ icon = 'spray', label, value, progress, done }: TaskChipProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: tokens.space[4],
        paddingTop: tokens.space[3],
        paddingBottom: tokens.space[3],
        paddingRight: tokens.space[4],
        paddingLeft: tokens.space[5],
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.color.surfaceRaised,
        boxShadow: tokens.shadow.card,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: tokens.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.surfaceSunken,
        }}
      >
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <KText variant="label" color="inkMuted" style={{ marginBottom: tokens.space[1] }}>
          {label}
        </KText>
        <KText
          variant="body"
          color={done ? 'inkMuted' : 'ink'}
          style={{
            fontFamily: tokens.type.heading.fontFamily,
            fontWeight: '500',
            lineHeight: 20,
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {value}
        </KText>
      </View>
      <Ring progress={progress} size={36} stroke={4} color="brand" />
    </View>
  );
}
