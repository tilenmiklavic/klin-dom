import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RoomDto } from '@klindom/shared';
import { Button, KText, tokens } from '@klindom/ui';

interface Props {
  rooms: RoomDto[];
  onChange: (rooms: RoomDto[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

/** Reorder mode: each room with up/down buttons (no drag dependency). */
export function ReorderList({ rooms, onChange, onSave, onCancel, saving }: Props) {
  const { t } = useTranslation();
  const move = (from: number, to: number) => {
    const next = [...rooms];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };
  return (
    <View style={{ gap: tokens.space[3] }}>
      <KText variant="label" color="inkMuted" accessibilityRole="header" style={{ paddingHorizontal: tokens.space[2] }}>
        {t('roomsTab.reorderTitle')}
      </KText>
      {rooms.map((room, i) => (
        <View
          key={room.id}
          style={{
            gap: tokens.space[3],
            padding: tokens.space[4],
            borderRadius: tokens.radius.md,
            backgroundColor: tokens.color.surfaceRaised,
            boxShadow: tokens.shadow.card,
          }}
        >
          <KText variant="body" numberOfLines={1}>
            {room.name}
          </KText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] }}>
            <Button variant="chip" size="sm" label={t('roomsTab.moveUp', { name: room.name })} disabled={i === 0} onPress={() => move(i, i - 1)} />
            <Button
              variant="chip"
              size="sm"
              label={t('roomsTab.moveDown', { name: room.name })}
              disabled={i === rooms.length - 1}
              onPress={() => move(i, i + 1)}
            />
          </View>
        </View>
      ))}
      <Button label={t('roomsTab.saveOrder')} loading={saving} onPress={onSave} />
      <Button variant="secondary" label={t('common.close')} onPress={onCancel} />
    </View>
  );
}
