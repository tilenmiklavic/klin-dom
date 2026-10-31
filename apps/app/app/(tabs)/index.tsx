import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { localDate, type DashboardDto, type TaskDto } from '@klindom/shared';
import { Button, Celebration, EmptyState, KText, Screen, SegmentedControl, Sheet, tokens, useToast } from '@klindom/ui';
import { DueList } from '../../src/components/home/DueList';
import { RingsCard } from '../../src/components/home/RingsCard';
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

  const timezone = home.data?.timezone ?? null;
  const today = timezone ? localDate(new Date(Date.now()), timezone) : null;
  const data = dashboard.data;

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
          </View>
          <RingsCard rings={data.rings} onRingClosed={(key) => key === 'today' && setCelebrating(true)} />
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
        <View style={{ alignItems: 'center', gap: tokens.space[3], padding: tokens.space[6], marginTop: tokens.space[8], borderRadius: tokens.radius.lg, backgroundColor: tokens.color.surfaceRaised }}>
          <KText variant="heading">{t('home.loadFailed')}</KText>
          <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
            {t('home.loadFailedBody')}
          </KText>
          <Button label={t('common.retry')} loading={dashboard.isFetching} onPress={() => void dashboard.refetch()} />
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
