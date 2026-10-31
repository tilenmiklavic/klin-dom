import { Pressable, View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { TickRing } from './TickRing';
import { KText } from './Text';
import { tokens } from './tokens';

export interface TaskRowProps {
  icon: IconName;
  name: string;
  caption: string;
  captionTone?: 'muted' | 'due';
  assignee?: { initial: string };
  done: boolean;
  onToggle: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  busy?: boolean;
}

export function TaskRow({
  icon,
  name,
  caption,
  captionTone = 'muted',
  assignee,
  done,
  onToggle,
  onPress,
  onLongPress,
  busy,
}: TaskRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space[3],
        paddingTop: tokens.space[3],
        paddingBottom: tokens.space[3],
        paddingLeft: tokens.space[3],
        paddingRight: 14,
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
      <View testID="task-row-text" style={{ flex: 1, minWidth: 0 }}>
        <KText
          variant="body"
          color={done ? 'inkMuted' : 'ink'}
          numberOfLines={1}
          style={{
            fontFamily: tokens.type.heading.fontFamily,
            fontWeight: '500',
            textDecorationLine: done ? 'line-through' : 'none',
          }}
        >
          {name}
        </KText>
        <KText
          variant="caption"
          color={captionTone === 'due' ? 'brandStrong' : 'inkMuted'}
          numberOfLines={1}
        >
          {caption}
        </KText>
      </View>
      {assignee ? <Avatar name={assignee.initial} size={22} /> : null}
      <TickRing
        done={done}
        disabled={busy}
        onPress={onToggle}
        accessibilityLabel={name}
      />
    </Pressable>
  );
}
