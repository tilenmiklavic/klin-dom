import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, ChoiceChips, KText, Screen, tokens } from '@klindom/ui';
import { Stepper } from '../../src/components/Stepper';
import { useSuggestions } from '../../src/data/homes';
import { useOnboardingDraft } from '../../src/state/onboardingDraft';

export default function Rooms() {
  const { t } = useTranslation();
  const router = useRouter();
  const { rooms, setRooms } = useOnboardingDraft();
  const suggestions = useSuggestions();
  const catalog = suggestions.data?.rooms ?? [];
  const chosen = catalog.filter((r) => r.key in rooms);

  const choose = (keys: string[]) => {
    const next: Record<string, number> = {};
    for (const key of keys) next[key] = rooms[key] ?? 1;
    setRooms(next);
  };

  return (
    <Screen title={t('rooms.title')}>
      <KText variant="body" color="inkMuted">
        {t('rooms.hint')}
      </KText>
      {suggestions.isError ? (
        <View style={{ gap: tokens.space[3] }}>
          <KText variant="body">{t('errors.generic')}</KText>
          <Button variant="secondary" label={t('gate.retry')} loading={suggestions.isFetching} onPress={() => void suggestions.refetch()} />
        </View>
      ) : (
        <ChoiceChips
          multiple
          options={catalog.map((r) => ({ value: r.key, label: r.name }))}
          value={Object.keys(rooms)}
          onChange={(v) => choose(v as string[])}
        />
      )}
      {chosen.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          {chosen.map((room) => (
            <Stepper
              key={room.key}
              label={room.name}
              value={rooms[room.key]!}
              min={1}
              max={5}
              fewerLabel={t('rooms.fewer', { room: room.name })}
              moreLabel={t('rooms.more', { room: room.name })}
              onChange={(count) => setRooms({ ...rooms, [room.key]: count })}
            />
          ))}
        </View>
      ) : null}
      <Button
        label={t('rooms.continue')}
        disabled={chosen.length === 0}
        onPress={() => router.push('/(onboarding)/review')}
      />
    </Screen>
  );
}
