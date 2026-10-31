import { Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDue, formatInterval, localDate } from '@klindom/shared';
import { Button, KText, ListGroup, ListRow, Screen, tokens } from '@klindom/ui';
import { useHome, useMembers } from '../../../src/data/homes';
import { useMuteTask, useTask, useTaskHistory } from '../../../src/data/tasks';
import { formatShortDate } from '../../../src/lib/time';
import { useCurrentHome } from '../../../src/state/currentHome';
import { keysFromOffsets } from '../../../src/tasks/reminders';

export default function TaskDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const members = useMembers(homeId);
  const task = useTask(id);
  const history = useTaskHistory(id);
  const mute = useMuteTask(homeId, id);

  const timezone = home.data?.timezone ?? null;
  const today = timezone ? localDate(new Date(Date.now()), timezone) : null;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/tasks'));
  const data = task.data;

  if (!data) {
    return (
      <Screen right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
        {task.isError ? <KText variant="body" color="inkMuted">{t('editor.loadFailed')}</KText> : null}
      </Screen>
    );
  }

  const assignee = data.assigneeId ? members.data?.find((m) => m.userId === data.assigneeId) : undefined;
  const reminders = (() => {
    if (data.reminderOffsets.length === 0) return t('reminders.none');
    const { keys, extra } = keysFromOffsets(data.reminderOffsets, data.dueTime);
    return [...keys.map((k) => t(`reminders.${k}`)), ...extra.map((count) => t('reminders.minutes', { count }))].join(', ');
  })();

  return (
    <Screen title={data.name} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      <ListGroup>
        {today ? <ListRow label={t('detail.due')} value={formatDue(data.nextDueDate, today).text} /> : null}
        <ListRow label={t('detail.repeats')} value={formatInterval(data.intervalCount, data.intervalUnit)} />
        <ListRow
          label={t('detail.assignee')}
          value={data.assigneeId ? (assignee?.displayName ?? t('detail.unknownMember')) : t('editor.household')}
        />
        <ListRow label={t('detail.rooms')} value={data.rooms.map((r) => r.name).join(', ')} />
        <ListRow label={t('detail.reminders')} value={reminders} />
        {data.notes ? <ListRow label={t('detail.notes')} value={data.notes} /> : null}
        <View
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: tokens.space[4],
          }}
        >
          <KText variant="body">{t('detail.remind')}</KText>
          <Switch
            accessibilityLabel={t('detail.remind')}
            value={!data.mutedByMe}
            disabled={mute.isPending}
            onValueChange={(on) => mute.mutate(!on)}
            trackColor={{ true: tokens.color.brand, false: tokens.color.surfaceSunken }}
          />
        </View>
      </ListGroup>
      <ListGroup title={t('detail.history')}>
        {history.data && history.data.length > 0 ? (
          history.data.map((c) => (
            <ListRow
              key={c.id}
              label={t('detail.entry', {
                name: c.userName,
                date: timezone ? formatShortDate(localDate(new Date(c.completedAt), timezone)) : '',
                status: t(c.kind === 'skip' ? 'detail.skipped' : c.onTime ? 'detail.onTime' : 'detail.late'),
              })}
            />
          ))
        ) : (
          <ListRow label={t('detail.historyEmpty')} />
        )}
      </ListGroup>
      <Button label={t('detail.edit')} onPress={() => router.push({ pathname: '/task-editor', params: { id: data.id } })} />
    </Screen>
  );
}
