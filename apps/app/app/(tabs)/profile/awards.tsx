import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addMonths, awardKinds, localDate, monthGrid, type AwardDto, type HistoryDto } from '@klindom/shared';
import { Button, KText, Ring, Screen, tokens } from '@klindom/ui';
import { ErrorCard } from '../../../src/components/ErrorCard';
import { awardNameKey } from '../../../src/awards/copy';
import { useHistory } from '../../../src/data/awards';
import { useHome } from '../../../src/data/homes';
import { formatMonth, formatShortDate } from '../../../src/lib/time';
import { useCurrentHome } from '../../../src/state/currentHome';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const CELL = 28;

export default function Awards() {
  const { t } = useTranslation();
  const router = useRouter();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const timezone = home.data?.timezone ?? null;
  // Until the server answers, "now" in the home's zone decides the first month.
  const initial = timezone ? localDate(new Date(Date.now()), timezone).slice(0, 7) : null;
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? initial;
  const history = useHistory(homeId, month);
  const data = history.data;
  const current = data?.today.date.slice(0, 7) ?? initial;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const go = (by: number) => month && setPicked(addMonths(month, by));

  return (
    <Screen title={t('awards.title')} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      {month ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button variant="chip" label={t('awards.prevMonth')} onPress={() => go(-1)} />
          <KText variant="heading" accessibilityRole="header">
            {formatMonth(month)}
          </KText>
          <Button variant="chip" label={t('awards.nextMonth')} disabled={month === current} onPress={() => go(1)} />
        </View>
      ) : null}
      {data && data.month === month ? <Calendar month={month} history={data} t={t} /> : null}
      {history.isError && !data ? (
        <ErrorCard title={t('awards.loadFailed')} body={t('home.loadFailedBody')} retrying={history.isFetching} onRetry={() => void history.refetch()} />
      ) : null}
      {data ? <AwardList awards={data.awards} timezone={timezone} t={t} /> : null}
    </Screen>
  );
}

type T = (k: string, o?: Record<string, unknown>) => string;

function Calendar({ month, history, t }: { month: string; history: HistoryDto; t: T }) {
  const { dates, leadingBlanks } = monthGrid(month);
  const byDate = new Map(history.days.map((d) => [d.date, d]));
  // Today comes from the live numbers; a stored row for today may lag behind.
  const cells = [...Array.from({ length: leadingBlanks }, () => null), ...dates];
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const last = rows[rows.length - 1];
  const trailing = last ? 7 - last.length : 0;

  return (
    <View style={{ gap: tokens.space[2], padding: tokens.space[4], borderRadius: tokens.radius.md, backgroundColor: tokens.color.surfaceRaised, boxShadow: tokens.shadow.card }}>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <KText testID="calendar-weekday" variant="caption" color="inkMuted">
              {t(`awards.weekdays.${w}`)}
            </KText>
          </View>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((date, c) => {
            if (!date) return <View key={c} testID="calendar-blank" style={{ flex: 1 }} />;
            const live = date === history.today.date ? history.today : byDate.get(date);
            const total = live?.total ?? 0;
            const done = live?.done ?? 0;
            const closed = date === history.today.date ? total > 0 && done >= total : (byDate.get(date)?.closed ?? false);
            const progress = closed ? 1 : total > 0 ? done / total : 0;
            const label = live ? t('awards.dayLabel', { date: formatShortDate(date), done, total }) : t('awards.dayNone', { date: formatShortDate(date) });
            return (
              <View key={c} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Ring progress={progress} size={CELL} stroke={3} color="brand" accessibilityLabel={label} />
                <KText variant="caption" color="inkMuted">
                  {Number(date.slice(8))}
                </KText>
              </View>
            );
          })}
          {r === rows.length - 1 ? Array.from({ length: trailing }, (_, i) => <View key={`pad${i}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

function AwardList({ awards, timezone, t }: { awards: AwardDto[]; timezone: string | null; t: T }) {
  return (
    <View style={{ gap: tokens.space[3] }}>
      <KText variant="heading" accessibilityRole="header">
        {t('awards.awardsHeading')}
      </KText>
      {awardKinds.map((kind) => {
        const earned = awards.filter((a) => a.kind === kind);
        if (earned.length === 0) {
          return (
            <View key={kind} style={{ flexDirection: 'row', justifyContent: 'space-between', opacity: 0.6 }}>
              <KText variant="body" color="inkMuted">
                {t(awardNameKey(kind))}
              </KText>
              <KText variant="caption" color="inkMuted">
                {t('awards.notYet')}
              </KText>
            </View>
          );
        }
        return earned.map((a) => {
          const when = formatShortDate(localDate(new Date(a.earnedAt), timezone ?? 'UTC'));
          return (
            <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <KText variant="body">{t(awardNameKey(kind))}</KText>
              <KText variant="caption" color="inkMuted">
                {a.userName ? `${a.userName} · ${when}` : when}
              </KText>
            </View>
          );
        });
      })}
    </View>
  );
}
