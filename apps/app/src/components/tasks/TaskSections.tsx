import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatInterval, type MemberDto, type TaskDto } from '@klindom/shared';
import { KText, TaskRow, tokens } from '@klindom/ui';
import type { Group } from '../../tasks/grouping';

interface Props {
  groups: Group[];
  members: MemberDto[];
  showRooms: boolean;
  busy: (id: string) => boolean;
  onComplete: (task: TaskDto) => void;
  onOpen: (taskId: string) => void;
  onSkip: (task: TaskDto) => void;
}

/** Titled sections of task rows. */
export function TaskSections({ groups, members, showRooms, busy, onComplete, onOpen, onSkip }: Props) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: tokens.space[5] }}>
      {groups.map((group) => (
        <View key={group.key} style={{ gap: tokens.space[3] }}>
          <KText variant="label" color="inkMuted" accessibilityRole="header" style={{ paddingHorizontal: tokens.space[2] }}>
            {group.title}
          </KText>
          {group.tasks.map((task) => {
            const interval = formatInterval(task.intervalCount, task.intervalUnit);
            const assignee = task.assigneeId ? members.find((m) => m.userId === task.assigneeId) : undefined;
            return (
              <TaskRow
                key={task.id}
                icon={task.icon}
                name={task.name}
                caption={showRooms ? `${interval} · ${task.rooms.map((r) => r.name).join(', ')}` : interval}
                captionTone={task.overdue ? 'due' : 'muted'}
                assignee={task.assigneeId ? { initial: assignee?.displayName ?? '?' } : undefined}
                done={false}
                busy={busy(task.id)}
                tickLabel={t('home.tickDone', { name: task.name })}
                onToggle={() => onComplete(task)}
                onPress={() => onOpen(task.id)}
                onLongPress={() => onSkip(task)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
