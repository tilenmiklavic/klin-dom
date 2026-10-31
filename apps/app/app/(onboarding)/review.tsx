import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, KText, ListGroup, Screen, TickRing, tokens } from '@klindom/ui';
import { formatInterval, type IntervalUnit } from '@klindom/shared';
import { ErrorCard } from '../../src/components/ErrorCard';
import { useCreateHomeFlow } from '../../src/onboarding/useCreateHomeFlow';
import { useSuggestions } from '../../src/data/homes';
import { useOnboardingDraft } from '../../src/state/onboardingDraft';

interface Row {
  key: string;
  name: string;
  intervalCount: number;
  intervalUnit: IntervalUnit;
}

export default function Review() {
  const { t } = useTranslation();
  const { name, timezone, rooms, excluded, setExcluded } = useOnboardingDraft();
  const suggestions = useSuggestions();
  const create = useCreateHomeFlow();

  const catalog = suggestions.data;
  const chosen = (catalog?.rooms ?? []).filter((r) => r.key in rooms);
  const roomGroups = chosen.map((room) => ({
    title: room.name,
    rows: room.tasks.map<Row>((task) => ({ ...task, key: `${room.key}.${task.key}` })),
  }));
  const shared = (catalog?.sharedTasks ?? [])
    .filter((task) => task.roomKeys.some((key) => key in rooms))
    .map<Row>((task) => ({ ...task, key: `shared.${task.key}` }));
  const groups = shared.length > 0 ? [...roomGroups, { title: t('review.shared'), rows: shared }] : roomGroups;
  const allKeys = groups.flatMap((g) => g.rows.map((r) => r.key));
  const ticked = allKeys.filter((key) => !excluded.includes(key));

  const toggle = (key: string) =>
    setExcluded(excluded.includes(key) ? excluded.filter((k) => k !== key) : [...excluded, key]);

  // A reload on the web drops the draft: go back to where the answers are collected.
  if (!name.trim() || Object.keys(rooms).length === 0) return <Redirect href="/(onboarding)/create" />;

  return (
    <Screen title={t('review.title')}>
      <KText variant="body" color="inkMuted">
        {t('review.hint')}
      </KText>
      {suggestions.isError && !catalog ? (
        <ErrorCard
          title={t('review.loadFailed')}
          body={t('review.loadFailedBody')}
          retrying={suggestions.isFetching}
          onRetry={() => void suggestions.refetch()}
        />
      ) : null}
      {groups.map((group) => (
        <ListGroup key={group.title} title={group.title}>
          {group.rows.map((row) => (
            <View
              key={row.key}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.space[4],
                paddingHorizontal: tokens.space[4],
                paddingVertical: tokens.space[3],
              }}
            >
              <TickRing done={!excluded.includes(row.key)} accessibilityLabel={row.name} onPress={() => toggle(row.key)} />
              <KText variant="body" numberOfLines={1} style={{ flexShrink: 1, flexGrow: 1 }}>
                {row.name}
              </KText>
              <KText variant="caption" color="inkMuted">
                {formatInterval(row.intervalCount, row.intervalUnit)}
              </KText>
            </View>
          ))}
        </ListGroup>
      ))}
      <Button
        label={t('review.create')}
        disabled={!catalog}
        loading={create.isPending}
        onPress={() =>
          create.mutate({
            name: name.trim(),
            timezone,
            suggestions: {
              rooms: chosen.map((r) => ({ key: r.key, count: rooms[r.key]! })),
              taskKeys: ticked,
            },
          })
        }
      />
    </Screen>
  );
}
