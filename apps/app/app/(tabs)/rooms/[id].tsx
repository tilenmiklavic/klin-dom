import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { localDate, type TaskDto } from '@klindom/shared';
import { Button, EmptyState, Icon, KText, Ring, Screen, Sheet, tokens, useToast } from '@klindom/ui';
import { ErrorCard } from '../../../src/components/ErrorCard';
import { TaskSections } from '../../../src/components/tasks/TaskSections';
import { useStatusText } from '../../../src/components/rooms/useStatusText';
import { useHome, useMembers } from '../../../src/data/homes';
import { useRooms } from '../../../src/data/rooms';
import { asDone, useCompleteTask, useSkipTask, useTasks, useUndoCompletion } from '../../../src/data/tasks';
import { roomFreshness, roomStatus } from '../../../src/rooms/status';
import { useCurrentHome } from '../../../src/state/currentHome';
import { groupByDue } from '../../../src/tasks/grouping';

export default function RoomDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const statusText = useStatusText();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const members = useMembers(homeId);
  const rooms = useRooms(homeId);
  const tasks = useTasks(homeId, 'all', id);
  const { complete, pending: completing } = useCompleteTask(homeId);
  const { skip, pending: skipPending } = useSkipTask(homeId);
  const { undo, pending: undoing } = useUndoCompletion(homeId);
  const [skipping, setSkipping] = useState<TaskDto | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/rooms'));
  const today = home.data ? localDate(new Date(Date.now()), home.data.timezone) : null;
  const room = rooms.data?.find((r) => r.id === id);

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

  if (!room) {
    return (
      <Screen right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
        {rooms.isError ? (
          <ErrorCard
            title={t('roomsTab.loadFailed')}
            body={t('roomsTab.loadFailedBody')}
            retrying={rooms.isFetching}
            onRetry={() => void rooms.refetch()}
          />
        ) : rooms.data ? (
          <KText variant="body" color="inkMuted">
            {t('roomsTab.notFound')}
          </KText>
        ) : (
          <KText variant="body" color="inkMuted">
            {t('common.loading')}
          </KText>
        )}
      </Screen>
    );
  }

  const groups = tasks.data && today ? groupByDue(tasks.data, today).map((g) => ({ ...g, title: t(`tasks.group.${g.key}`) })) : null;

  return (
    <Screen title={room.name} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      {tasks.data && today ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[4] }}>
          <View>
            <Ring
              progress={roomFreshness(tasks.data, today)}
              size={64}
              stroke={7}
              color="brand"
              accessibilityLabel={t('roomsTab.freshness', { name: room.name })}
            />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={room.icon} size={24} />
            </View>
          </View>
          <KText variant="body" color={roomStatus(tasks.data, today).tone === 'due' ? 'brandStrong' : 'inkMuted'}>
            {statusText(roomStatus(tasks.data, today))}
          </KText>
        </View>
      ) : null}
      {groups && groups.length === 0 ? (
        <EmptyState
          icon="checklist"
          title={t('roomsTab.noTasks')}
          body={t('tasks.emptyBody')}
          action={{ label: t('tasks.add'), onPress: () => router.push('/task-editor') }}
        />
      ) : groups ? (
        <TaskSections
          groups={groups}
          members={members.data ?? []}
          showRooms={false}
          busy={(taskId) => completing.has(taskId) || skipPending.has(taskId) || undoing.has(taskId)}
          onComplete={(task) => void onComplete(task)}
          onOpen={(taskId) => router.push(`/tasks/${taskId}`)}
          onSkip={setSkipping}
        />
      ) : tasks.isError ? (
        <ErrorCard title={t('tasks.loadFailed')} body={t('tasks.loadFailedBody')} retrying={tasks.isFetching} onRetry={() => void tasks.refetch()} />
      ) : null}
      <Button variant="secondary" label={t('roomsTab.edit')} onPress={() => router.push({ pathname: '/room-editor', params: { id: room.id } })} />
      <Sheet visible={skipping !== null} onClose={() => setSkipping(null)} title={skipping?.name ?? ''} closeLabel={t('common.close')}>
        <Button variant="secondary" label={t('home.skip')} onPress={() => void onSkip()} />
      </Sheet>
    </Screen>
  );
}
