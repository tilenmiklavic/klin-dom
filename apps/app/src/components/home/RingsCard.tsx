import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DashboardDto } from '@klindom/shared';
import { Rings, tokens } from '@klindom/ui';

/** The three nested rings with their legend, on a raised card. */
export function RingsCard({ rings }: { rings: DashboardDto['rings'] }) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        alignItems: 'center',
        padding: tokens.space[5],
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.color.surfaceRaised,
        boxShadow: tokens.shadow.card,
      }}
    >
      <Rings
        rings={[
          { key: 'today', label: t('home.ringToday'), value: rings.today.done, total: rings.today.total, color: 'brand' },
          { key: 'week', label: t('home.ringWeek'), value: rings.week.done, total: rings.week.total, color: 'ink' },
          { key: 'fresh', label: t('home.ringFresh'), value: rings.fresh.pct, total: 100, unit: '%', color: 'ringFresh' },
        ]}
      />
    </View>
  );
}
