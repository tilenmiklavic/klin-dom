import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDue, type DashboardDto, type MemberDto, type TaskDto } from '@klindom/shared';
import { TaskRow, tokens } from '@klindom/ui';
import { formatClock } from '../../lib/time';

type Done = DashboardDto['doneToday'][number];

interface Props {
  dashboard: DashboardDto;
  members: MemberDto[];
  today: string | null;
  timezone: string | null;
  busy: (id: string) => boolean;
  onComplete: (task: TaskDto) => void;
  onUndo: (done: Done) => void;
  onOpen: (taskId: string) => void;
  onSkip: (task: TaskDto) => void;
}

/** Tasks still due (API order) followed by what was done today. */
export function DueList({ dashboard, members, today, timezone, busy, onComplete, onUndo, onOpen, onSkip }: Props) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: tokens.space[3] }}>
      {dashboard.dueToday.map((task) => {
        const due = task.overdue && today ? formatDue(task.nextDueDate, today) : null;
        const assignee = task.assigneeId ? members.find((m) => m.userId === task.assigneeId) : undefined;
        return (
          <TaskRow
            key={task.id}
            icon={task.icon}
            name={task.name}
            caption={due ? due.text : task.rooms.map((r) => r.name).join(', ')}
            captionTone={due?.tone ?? 'muted'}
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
      {dashboard.doneToday.map((row) => (
        <TaskRow
          key={row.id}
          icon={row.taskIcon}
          name={row.taskName}
          caption={t('home.doneBy', { name: row.userName, time: timezone ? formatClock(row.completedAt, timezone) : '' })}
          done
          busy={busy(row.id) || busy(row.taskId)}
          tickLabel={t('home.tickUndone', { name: row.taskName })}
          onToggle={() => onUndo(row)}
          onPress={() => onOpen(row.taskId)}
        />
      ))}
    </View>
  );
}
