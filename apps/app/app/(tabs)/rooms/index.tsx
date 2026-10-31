import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { localDate, type RoomDto } from '@klindom/shared';
import { Button, KText, RoomCard, Screen, tokens, useToast } from '@klindom/ui';
import { ReorderList } from '../../../src/components/rooms/ReorderList';
import { useStatusText } from '../../../src/components/rooms/useStatusText';
import { useHome } from '../../../src/data/homes';
import { useReorderRooms, useRooms } from '../../../src/data/rooms';
import { useTasks } from '../../../src/data/tasks';
import { summarizeRooms } from '../../../src/rooms/summary';
import { useCurrentHome } from '../../../src/state/currentHome';

export default function Rooms() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const statusText = useStatusText();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const rooms = useRooms(homeId);
  const tasks = useTasks(homeId, 'all');
  const reorder = useReorderRooms(homeId);
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<RoomDto[]>([]);

  const today = home.data ? localDate(new Date(Date.now()), home.data.timezone) : null;
  const summaries = today && rooms.data && tasks.data ? summarizeRooms(rooms.data, tasks.data, today) : null;
  const freshCount = summaries?.filter((s) => s.freshness === 1).length ?? 0;

  // Leave reorder mode if the list disappears (home switch).
  useEffect(() => {
    if (!rooms.data) setReordering(false);
  }, [rooms.data]);

  const startReorder = () => {
    if (!rooms.data || rooms.data.length < 2) return;
    setOrder(rooms.data);
    setReordering(true);
  };
  const saveOrder = async () => {
    const unchanged = order.every((r, i) => r.id === rooms.data?.[i]?.id);
    if (!unchanged) {
      try {
        await reorder.mutateAsync(order.map((r) => r.id));
      } catch {
        toast.show({ message: t('errors.saveFailed') });
        return;
      }
      toast.show({ message: t('roomsTab.orderSaved') });
    }
    setReordering(false);
  };

  const tiles = [
    ...(summaries ?? []).map((s) => (
      <RoomCard
        key={s.room.id}
        icon={s.room.icon}
        name={s.room.name}
        freshness={s.freshness}
        status={statusText(s.status)}
        statusTone={s.status.tone}
        onPress={() => router.push(`/rooms/${s.room.id}`)}
        onLongPress={startReorder}
      />
    )),
    <Pressable
      key="add"
      accessibilityRole="button"
      accessibilityLabel={t('roomsTab.add')}
      onPress={() => router.push('/room-editor')}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.space[4],
        minHeight: 108,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.color.surfaceSunken,
        boxShadow: tokens.shadow.inset,
      }}
    >
      <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
        {`+ ${t('roomsTab.add')}`}
      </KText>
    </Pressable>,
  ];
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <Screen
      title={t('tabs.rooms')}
      right={
        summaries && summaries.length > 1 && !reordering ? (
          <Button variant="chip" label={t('roomsTab.reorder')} onPress={startReorder} />
        ) : undefined
      }
    >
      {summaries ? (
        reordering ? (
          <ReorderList
            rooms={order}
            onChange={setOrder}
            onSave={() => void saveOrder()}
            onCancel={() => setReordering(false)}
            saving={reorder.isPending}
          />
        ) : (
          <>
            <KText variant="body" color="inkMuted">
              {t('roomsTab.summary', { count: summaries.length, fresh: freshCount })}
            </KText>
            <View style={{ gap: tokens.space[3] }}>
              {rows.map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: tokens.space[3] }}>
                  {[row[0], row[1] ?? <View key="gap" />].map((tile, j) => (
                    <View key={j} style={{ flex: 1 }}>
                      {tile}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )
      ) : rooms.isError || tasks.isError ? (
        <View style={{ alignItems: 'center', gap: tokens.space[3], padding: tokens.space[6], borderRadius: tokens.radius.lg, backgroundColor: tokens.color.surfaceRaised }}>
          <KText variant="heading">{t('roomsTab.loadFailed')}</KText>
          <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
            {t('roomsTab.loadFailedBody')}
          </KText>
          <Button
            label={t('common.retry')}
            loading={rooms.isFetching || tasks.isFetching}
            onPress={() => {
              void rooms.refetch();
              void tasks.refetch();
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
