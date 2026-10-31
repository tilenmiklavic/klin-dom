import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ApiError, iconNames, type IconName, type RoomDto } from '@klindom/shared';
import { Button, ChoiceChips, KText, Screen, Sheet, TextField, tokens, useToast } from '@klindom/ui';
import { Field } from '../src/components/tasks/Field';
import { useArchiveRoom, useCreateRoom, useRooms, useUpdateRoom } from '../src/data/rooms';
import { useCurrentHome } from '../src/state/currentHome';

/** Create (no `id`) or edit (`?id=`) a room. Waits for the rooms, then mounts the form. */
export default function RoomEditor() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { homeId } = useCurrentHome();
  const rooms = useRooms(homeId);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/rooms'));
  const room = id ? rooms.data?.find((r) => r.id === id) : undefined;
  const ready = rooms.data && (!id || room);

  return (
    <Screen
      title={t(id ? 'roomsTab.editTitle' : 'roomsTab.newTitle')}
      right={<Button variant="chip" label={t('common.close')} onPress={close} />}
    >
      {ready ? (
        <EditorForm key={room?.id ?? 'new'} homeId={homeId} room={room} close={close} />
      ) : rooms.data && id ? (
        <KText variant="body" color="inkMuted">
          {t('roomsTab.notFound')}
        </KText>
      ) : null}
    </Screen>
  );
}

function EditorForm({ homeId, room, close }: { homeId: string | null; room?: RoomDto; close: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(room?.name ?? '');
  const [icon, setIcon] = useState<IconName>(room?.icon ?? 'sparkle');
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const create = useCreateRoom(homeId);
  const update = useUpdateRoom(homeId, room?.id ?? '');
  const archive = useArchiveRoom(homeId, room?.id ?? '');

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('roomsTab.nameRequired'));
      return;
    }
    try {
      if (room) {
        const patch = { ...(trimmed !== room.name ? { name: trimmed } : {}), ...(icon !== room.icon ? { icon } : {}) };
        if (Object.keys(patch).length > 0) await update.mutateAsync(patch);
      } else {
        await create.mutateAsync({ name: trimmed, icon });
      }
    } catch {
      toast.show({ message: t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t(room ? 'roomsTab.saved' : 'roomsTab.added') });
    close();
  };

  const doArchive = async () => {
    setConfirming(false); // a toast hides beneath an open sheet
    try {
      await archive.mutateAsync();
    } catch (e) {
      toast.show({ message: e instanceof ApiError && e.status === 409 ? e.message : t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t('roomsTab.archived') });
    router.dismissTo('/rooms');
  };

  return (
    <View style={{ gap: tokens.space[5] }}>
      <TextField
        label={t('roomsTab.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        error={error}
        maxLength={40}
      />
      <Field label={t('roomsTab.icon')}>
        <ChoiceChips value={icon} options={iconNames.map((n) => ({ value: n, label: t(`icons.${n}`) }))} onChange={(v) => setIcon(v as IconName)} />
      </Field>
      <Button label={t('roomsTab.save')} loading={create.isPending || update.isPending} onPress={() => void save()} />
      {room ? <Button variant="secondary" label={t('roomsTab.archive')} onPress={() => setConfirming(true)} /> : null}
      <Sheet visible={confirming} onClose={() => setConfirming(false)} title={t('roomsTab.archiveTitle')} closeLabel={t('common.close')}>
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {t('roomsTab.archiveBody')}
          </KText>
          <Button label={t('roomsTab.archive')} loading={archive.isPending} onPress={() => void doArchive()} />
          <Button variant="secondary" label={t('roomsTab.keep')} onPress={() => setConfirming(false)} />
        </View>
      </Sheet>
    </View>
  );
}
