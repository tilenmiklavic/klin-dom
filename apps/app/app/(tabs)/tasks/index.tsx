import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { localDate, type TaskDto } from '@klindom/shared';
import { ActionOrb, Button, EmptyState, KText, Screen, SegmentedControl, Sheet, tokens, useToast } from '@klindom/ui';
import { TaskSections } from '../../../src/components/tasks/TaskSections';
import { useHome, useMembers } from '../../../src/data/homes';
import { useRooms } from '../../../src/data/rooms';
import { asDone, useCompleteTask, useSkipTask, useTasks, useUndoCompletion } from '../../../src/data/tasks';
import { useCurrentHome } from '../../../src/state/currentHome';
import { groupByDue, groupByRoom, type Group } from '../../../src/tasks/grouping';

type View_ = 'all' | 'mine' | 'room';

export default function Tasks() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const [view, setView] = useState<View_>('all');
  const [skipping, setSkipping] = useState<TaskDto | null>(null);

  const tasks = useTasks(homeId, view === 'mine' ? 'mine' : 'all');
  const home = useHome(homeId);
  const members = useMembers(homeId);
  const rooms = useRooms(homeId);
  const { complete, pending: completing } = useCompleteTask(homeId);
  const { skip, pending: skipPending } = useSkipTask(homeId);
  const { undo, pending: undoing } = useUndoCompletion(homeId);

  const timezone = home.data?.timezone ?? null;
  const today = timezone ? localDate(new Date(Date.now()), timezone) : null;

  const onComplete = async (task: TaskDto) => {
    const result = await complete(task);
    if (!result) return;
    toast.show({
      message: t('home.completed', { name: task.name }),
      durationMs: 10_000,
      action: { label: t('home.undo'), onPress: () => void undo(asDone(task, result.completion)) },
    });
  };
  const onSkip = async () => {
    const task = skipping;
    if (!task) return;
    setSkipping(null); // a toast hides beneath an open sheet
    await skip(task);
  };

  let groups: Group[] | null = null;
  if (tasks.data) {
    if (view === 'room') groups = groupByRoom(tasks.data, rooms.data ?? []);
    else if (today) groups = groupByDue(tasks.data, today).map((g) => ({ ...g, title: t(`tasks.group.${g.key}`) }));
  }

  return (
    <Screen
      title={t('tabs.tasks')}
      right={<ActionOrb size="sm" icon="sparkle" label={t('tasks.add')} onPress={() => router.push('/task-editor')} />}
    >
      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as View_)}
        options={[
          { value: 'all', label: t('tasks.scopeAll') },
          { value: 'mine', label: t('tasks.scopeMine') },
          { value: 'room', label: t('tasks.scopeRoom') },
        ]}
      />
      {groups && groups.length === 0 ? (
        <EmptyState
          icon="checklist"
          title={t(view === 'mine' ? 'tasks.emptyMineTitle' : 'tasks.emptyTitle')}
          body={t(view === 'mine' ? 'tasks.emptyMineBody' : 'tasks.emptyBody')}
          action={view === 'mine' ? undefined : { label: t('tasks.add'), onPress: () => router.push('/task-editor') }}
        />
      ) : groups ? (
        <TaskSections
          groups={groups}
          members={members.data ?? []}
          showRooms={view !== 'room'}
          busy={(id) => completing.has(id) || skipPending.has(id) || undoing.has(id)}
          onComplete={(task) => void onComplete(task)}
          onOpen={(id) => router.push(`/tasks/${id}`)}
          onSkip={setSkipping}
        />
      ) : tasks.isError ? (
        <View style={{ alignItems: 'center', gap: tokens.space[3], padding: tokens.space[6], borderRadius: tokens.radius.lg, backgroundColor: tokens.color.surfaceRaised }}>
          <KText variant="heading">{t('tasks.loadFailed')}</KText>
          <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
            {t('tasks.loadFailedBody')}
          </KText>
          <Button label={t('common.retry')} loading={tasks.isFetching} onPress={() => void tasks.refetch()} />
        </View>
      ) : null}
      <Sheet visible={skipping !== null} onClose={() => setSkipping(null)} title={skipping?.name ?? ''} closeLabel={t('common.close')}>
        <Button variant="secondary" label={t('home.skip')} onPress={() => void onSkip()} />
      </Sheet>
    </Screen>
  );
}
