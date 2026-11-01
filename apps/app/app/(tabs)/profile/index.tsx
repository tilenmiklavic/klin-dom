import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, KText, ListGroup, ListRow, MemberBars, Screen, SegmentedControl, Sheet, tokens, useToast } from '@klindom/ui';
import type { InviteDto } from '@klindom/shared';
import { useBootstrap } from '../../../src/data/homes';
import { useCreateInvite, useInvites } from '../../../src/data/invites';
import { useStats, type StatsRange } from '../../../src/data/stats';
import { useCopyInviteLink, useShareInvite } from '../../../src/invite/useShareInvite';
import { useMemberSettings } from '../../../src/data/notifications';
import { useCurrentHome } from '../../../src/state/currentHome';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const bootstrap = useBootstrap();
  const [range, setRange] = useState<StatsRange>('week');
  const stats = useStats(homeId, range);
  const memberSettings = useMemberSettings(homeId);
  const invite = useCreateInvite(homeId ?? '');
  const invites = useInvites(homeId);
  const home = bootstrap.data?.homes.find((h) => h.id === homeId);
  const share = useShareInvite(home?.name ?? '');
  const copyLink = useCopyInviteLink();
  const name = bootstrap.data?.user.displayName ?? '';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<InviteDto | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Opens the invite sheet with an active invite (reusing one when it exists). Sharing happens on the
   * sheet's own button so it starts inside that tap, not after a slow request.
   */
  const inviteSomeone = async () => {
    if (sheetOpen) return;
    if (invite.isPending) {
      setSheetOpen(true); // the first tap is still creating it; the sheet fills in when it lands
      return;
    }
    setCopied(false);
    setActive(null);
    setSheetOpen(true);
    try {
      const existing = invites.data ?? (await invites.refetch()).data;
      setActive(existing?.[0] ?? (await invite.mutateAsync()));
    } catch {
      setSheetOpen(false); // a toast hides beneath an open sheet
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
        <ListRow
          label={t('profile.notifications')}
          value={memberSettings.data ? t(memberSettings.data.notificationsEnabled ? 'notifications.on' : 'notifications.off') : undefined}
          onPress={() => router.push('/profile/notifications')}
        />
        <ListRow label={t('profile.account')} onPress={() => router.push('/profile/account')} />
      </ListGroup>
      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={t('profile.inviteTitle')} closeLabel={t('common.close')}>
        <View style={{ gap: tokens.space[4] }}>
          {active ? (
            <>
              <View style={{ gap: tokens.space[1] }}>
                <KText variant="caption" color="inkMuted">
                  {t('invite.code')}
                </KText>
                <KText variant="heading" selectable>
                  {active.code}
                </KText>
                <KText variant="caption" color="inkMuted" selectable>
                  {active.url}
                </KText>
              </View>
              <Button
                label={t('invite.share')}
                onPress={() => {
                  void share(active.url).then(() => setSheetOpen(false));
                }}
              />
              <Button
                variant="secondary"
                label={t('invite.copy')}
                onPress={() => {
                  void copyLink(active.url).then(() => setCopied(true));
                }}
              />
              {copied ? (
                <KText variant="caption" color="inkMuted" accessibilityLiveRegion="polite">
                  {t('invite.copied')}
                </KText>
              ) : null}
            </>
          ) : (
            <Button label={t('invite.share')} loading disabled onPress={() => undefined} />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
