import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, KText, ListGroup, ListRow, MemberBars, Screen, SegmentedControl, tokens, useToast } from '@klindom/ui';
import { useBootstrap } from '../../../src/data/homes';
import { useCreateInvite } from '../../../src/data/invites';
import { useStats, type StatsRange } from '../../../src/data/stats';
import { useShareInvite } from '../../../src/invite/useShareInvite';
import { useCurrentHome } from '../../../src/state/currentHome';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const bootstrap = useBootstrap();
  const [range, setRange] = useState<StatsRange>('week');
  const stats = useStats(homeId, range);
  const invite = useCreateInvite(homeId ?? '');
  const home = bootstrap.data?.homes.find((h) => h.id === homeId);
  const share = useShareInvite(home?.name ?? '');
  const name = bootstrap.data?.user.displayName ?? '';

  const inviteSomeone = async () => {
    try {
      const created = await invite.mutateAsync();
      await share(created.url);
    } catch {
      toast.show({ message: t('profile.inviteFailed') });
    }
  };

  const members = stats.data?.perMember ?? [];
  return (
    <Screen title={t('tabs.profile')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[4] }}>
        <Avatar name={name} size={56} />
        <View style={{ flexShrink: 1 }}>
          <KText variant="heading">{name}</KText>
          {home ? (
            <KText variant="body" color="inkMuted">
              {t('profile.homeRole', { home: home.name, role: t(`profile.${home.role}`) })}
            </KText>
          ) : null}
        </View>
      </View>

      <View
        style={{
          gap: tokens.space[4],
          padding: tokens.space[5],
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.surfaceRaised,
          boxShadow: tokens.shadow.card,
        }}
      >
        <KText variant="heading" accessibilityRole="header">
          {t('profile.whoDidWhat')}
        </KText>
        <SegmentedControl
          value={range}
          onChange={(v) => setRange(v as StatsRange)}
          options={[
            { value: 'week', label: t('profile.week') },
            { value: 'month', label: t('profile.month') },
          ]}
        />
        {stats.isError ? (
          <View style={{ gap: tokens.space[3] }}>
            <KText variant="body" color="inkMuted">
              {t('profile.statsFailed')}
            </KText>
            <Button variant="secondary" label={t('common.retry')} onPress={() => void stats.refetch()} />
          </View>
        ) : stats.data ? (
          members.length > 0 && stats.data.total > 0 ? (
            <>
              <MemberBars rows={members.map((m) => ({ name: m.name, value: m.done }))} />
              <View style={{ gap: tokens.space[3] }}>
                {members.map((m) => (
                  <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] }}>
                    <Avatar name={m.name} />
                    <KText variant="body" style={{ flex: 1 }} numberOfLines={1}>
                      {m.name}
                    </KText>
                    <KText variant="caption" color="inkMuted">
                      {t('profile.onTimeCount', { count: m.onTime })}
                    </KText>
                    <KText variant="label">{t('profile.doneCount', { count: m.done })}</KText>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <KText variant="body" color="inkMuted">
              {t('profile.statsEmpty')}
            </KText>
          )
        ) : null}
      </View>

      <ListGroup title={t('profile.home')}>
        <ListRow label={t('profile.members')} onPress={() => router.push('/profile/members')} />
        <ListRow label={t('profile.invite')} onPress={() => void inviteSomeone()} />
        <ListRow label={t('profile.homeSettings')} onPress={() => router.push('/profile/home')} />
      </ListGroup>

      <ListGroup title={t('profile.you')}>
        <ListRow label={t('profile.notifications')} value={t('profile.comingSoon')} />
        <ListRow label={t('profile.account')} onPress={() => router.push('/profile/account')} />
      </ListGroup>
    </Screen>
  );
}
