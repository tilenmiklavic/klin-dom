import { Pressable, View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Icon } from './Icon';
import { Ring } from './Ring';
import { KText } from './Text';
import { tokens } from './tokens';

export interface RoomCardProps {
  icon: IconName;
  name: string;
  freshness: number;
  status: string;
  statusTone?: 'muted' | 'due';
  onPress: () => void;
  onLongPress?: () => void;
}

export function RoomCard({
  icon,
  name,
  freshness,
  status,
  statusTone = 'muted',
  onPress,
  onLongPress,
}: RoomCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        padding: tokens.space[4],
        gap: tokens.space[3],
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.color.surfaceRaised,
        boxShadow: tokens.shadow.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <Ring progress={freshness} size={36} stroke={4} color="brand" />
      </View>
      <View>
        <KText
          variant="body"
          numberOfLines={1}
          style={{ fontFamily: tokens.type.heading.fontFamily, fontWeight: '500' }}
        >
          {name}
        </KText>
        <KText
          variant="caption"
          color={statusTone === 'due' ? 'brandStrong' : 'inkMuted'}
          numberOfLines={1}
        >
          {status}
        </KText>
      </View>
    </Pressable>
  );
}
