import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { localDate, type DashboardDto, type TaskDto } from '@klindom/shared';
import { Button, Celebration, EmptyState, KText, Screen, SegmentedControl, Sheet, tokens, useToast } from '@klindom/ui';
import { DueList } from '../../src/components/home/DueList';
import { ErrorCard } from '../../src/components/ErrorCard';
import { RingsCard } from '../../src/components/home/RingsCard';
import { awardNameKey } from '../../src/awards/copy';
import { useMarkAwardsSeen } from '../../src/data/awards';
import { useDashboard, type Scope } from '../../src/data/dashboard';
import { useHome, useMembers } from '../../src/data/homes';
import { asDone, useCompleteTask, useSkipTask, useUndoCompletion } from '../../src/data/tasks';
import { formatLongDate } from '../../src/lib/time';
import { useCurrentHome } from '../../src/state/currentHome';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const [scope, setScope] = useState<Scope>('all');
  const [celebrating, setCelebrating] = useState(false);
  const [skipping, setSkipping] = useState<TaskDto | null>(null);

  const dashboard = useDashboard(homeId, scope);
  const home = useHome(homeId);
  const members = useMembers(homeId);
  const { complete, pending: completing } = useCompleteTask(homeId);
  const { skip, pending: skipPending } = useSkipTask(homeId);
  const { undo, pending: undoing } = useUndoCompletion(homeId);

  const markSeen = useMarkAwardsSeen(homeId);
  // Award ids already celebrated: the dashboard polls and refetches on focus, so it can list one again.
  const handledAwards = useRef(new Set<string>());
  const newAwards = dashboard.data?.newAwards;
  useEffect(() => {
    const fresh = newAwards?.filter((a) => !handledAwards.current.has(a.id)) ?? [];
    if (fresh.length === 0) return;
    fresh.forEach((a) => handledAwards.current.add(a.id));
    setCelebrating(true);
    toast.show({ message: t('awards.newToast', { name: t(awardNameKey(fresh[0]!.kind)) }) });
    void markSeen();
  }, [newAwards, markSeen, toast, t]);

  const timezone = home.data?.timezone ?? null;
  const today = timezone ? localDate(new Date(Date.now()), timezone) : null;
  const data = dashboard.data;

  const onComplete = async (task: TaskDto) => {
    const before = data?.rings;
    const result = await complete(task);
    if (!result) return;
    // Celebrate only what the server confirmed: a ring that was open before this tick and is closed now.
    if (before && closedByTick(before, result.rings)) setCelebrating(true);
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

  return (
    <Screen>
      {data ? (
        <>
          <View style={{ alignItems: 'center', gap: tokens.space[1], paddingTop: tokens.space[4] }}>
            <KText variant="display" style={{ textAlign: 'center' }}>
              {greeting(data.rings, t)}
            </KText>
            {today ? (
              <KText variant="body" color="inkMuted">
                {formatLongDate(today)}
              </KText>
            ) : null}
            {data.streak > 0 ? (
              <KText variant="label" color="brandStrong">
                {t('home.streak', { count: data.streak })}
              </KText>
            ) : null}
          </View>
          <RingsCard rings={data.rings} />
          <SegmentedControl
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            options={[
              { value: 'all', label: t('home.scopeAll') },
              { value: 'mine', label: t('home.scopeMine') },
            ]}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <KText variant="title" accessibilityRole="header">
              {t('home.dueToday')}
            </KText>
            <Button variant="chip" label={t('home.seeAll')} onPress={() => router.push('/tasks')} />
          </View>
          {data.dueToday.length === 0 && data.doneToday.length === 0 ? (
            <EmptyState
              icon="sparkle"
              title={t('home.emptyTitle')}
              body={t('home.emptyBody')}
              action={{ label: t('home.addTask'), onPress: () => router.push('/task-editor') }}
            />
          ) : (
            <DueList
              dashboard={data}
              members={members.data ?? []}
              today={today}
              timezone={timezone}
              busy={(id) => completing.has(id) || skipPending.has(id) || undoing.has(id)}
              onComplete={(task) => void onComplete(task)}
              onUndo={(row) => void undo(row)}
              onOpen={(id) => router.push(`/tasks/${id}`)}
              onSkip={setSkipping}
            />
          )}
        </>
      ) : dashboard.isError ? (
        <View style={{ marginTop: tokens.space[8] }}>
          <ErrorCard title={t('home.loadFailed')} body={t('home.loadFailedBody')} retrying={dashboard.isFetching} onRetry={() => void dashboard.refetch()} />
        </View>
      ) : null}
      <Sheet visible={skipping !== null} onClose={() => setSkipping(null)} title={skipping?.name ?? ''} closeLabel={t('common.close')}>
        <Button variant="secondary" label={t('home.skip')} onPress={() => void onSkip()} />
      </Sheet>
      <Celebration visible={celebrating} onDone={() => setCelebrating(false)} />
    </Screen>
  );
}

function greeting(rings: DashboardDto['rings'], t: (k: string) => string): string {
  if (rings.today.done === 0) return t('home.greetingFresh');
  return rings.today.done >= rings.today.total ? t('home.greetingDone') : t('home.greetingGoing');
}

const isClosed = (done: number, total: number) => total > 0 && done >= total;

function closedByTick(before: DashboardDto['rings'], after: DashboardDto['rings']): boolean {
  return (
    (!isClosed(before.today.done, before.today.total) && isClosed(after.today.done, after.today.total)) ||
    (!isClosed(before.week.done, before.week.total) && isClosed(after.week.done, after.week.total))
  );
}
