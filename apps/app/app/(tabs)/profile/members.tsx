import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ApiError, type MemberDto } from '@klindom/shared';
import { Avatar, Button, KText, ListGroup, ListRow, Screen, Sheet, tokens, useToast } from '@klindom/ui';
import { useBootstrap, useHome, useMembers, useRemoveMember, useTransferHome } from '../../../src/data/homes';
import { useInvites, useRevokeInvite } from '../../../src/data/invites';
import { useCurrentHome } from '../../../src/state/currentHome';

type Pending = { kind: 'remove' | 'transfer'; member: MemberDto };

export default function Members() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { homeId } = useCurrentHome();
  const home = useHome(homeId);
  const members = useMembers(homeId);
  const invites = useInvites(homeId);
  const me = useBootstrap().data?.user.id;
  const remove = useRemoveMember(homeId);
  const transfer = useTransferHome(homeId);
  const revoke = useRevokeInvite(homeId);
  const [pending, setPending] = useState<Pending | null>(null);
  const isOwner = home.data?.role === 'owner';

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const errorText = (e: unknown) => (e instanceof ApiError && e.status === 409 ? e.message : t('errors.saveFailed'));

  const confirm = async () => {
    if (!pending) return;
    const { kind, member } = pending;
    setPending(null); // a toast hides beneath an open sheet
    try {
      if (kind === 'remove') await remove.mutateAsync(member.userId);
      else await transfer.mutateAsync(member.userId);
    } catch (e) {
      toast.show({ message: errorText(e) });
      return;
    }
    toast.show({ message: t(kind === 'remove' ? 'profile.removed' : 'profile.transferred', { name: member.displayName }) });
  };

  const doRevoke = async (inviteId: string) => {
    try {
      await revoke.mutateAsync(inviteId);
    } catch {
      toast.show({ message: t('errors.saveFailed') });
      return;
    }
    toast.show({ message: t('profile.revoked') });
  };

  return (
    <Screen title={t('profile.membersTitle')} right={<Button variant="chip" label={t('common.back')} onPress={back} />}>
      {members.isError ? (
        <View style={{ gap: tokens.space[3] }}>
          <KText variant="body" color="inkMuted">
            {t('profile.loadFailed')}
          </KText>
          <Button variant="secondary" label={t('common.retry')} onPress={() => void members.refetch()} />
        </View>
      ) : null}
      {members.data ? (
        <ListGroup>
          {members.data.map((m) => (
            <View
              key={m.userId}
              testID={`member-row-${m.userId}`}
              style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: tokens.space[3], padding: tokens.space[3], paddingHorizontal: tokens.space[4] }}
            >
              <Avatar name={m.displayName} size={32} />
              <View style={{ flex: 1 }}>
                <KText variant="body" numberOfLines={1}>
                  {m.displayName}
                </KText>
                <KText variant="caption" color="inkMuted">
                  {t(`profile.${m.role}`)}
                </KText>
              </View>
              {isOwner && m.userId !== me ? (
                <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
                  <Button variant="chip" size="sm" label={t('profile.makeOwner')} onPress={() => setPending({ kind: 'transfer', member: m })} />
                  <Button variant="chip" size="sm" label={t('profile.remove')} onPress={() => setPending({ kind: 'remove', member: m })} />
                </View>
              ) : null}
            </View>
          ))}
        </ListGroup>
      ) : null}

      {invites.data ? (
        <ListGroup title={t('profile.invitesTitle')}>
          {invites.data.length === 0 ? (
            <ListRow label={t('profile.noInvites')} />
          ) : (
            invites.data.map((inv) => (
              <View
                key={inv.id}
                style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.space[3], paddingHorizontal: tokens.space[4], paddingVertical: tokens.space[3] }}
              >
                <KText variant="body" selectable>
                  {inv.code}
                </KText>
                <Button variant="chip" size="sm" label={t('profile.revoke')} onPress={() => void doRevoke(inv.id)} />
              </View>
            ))
          )}
        </ListGroup>
      ) : null}

      <Sheet
        visible={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? t(pending.kind === 'remove' ? 'profile.removeTitle' : 'profile.transferTitle', { name: pending.member.displayName }) : ''}
        closeLabel={t('common.close')}
      >
        <View style={{ gap: tokens.space[4] }}>
          <KText variant="body" color="inkMuted">
            {pending ? t(pending.kind === 'remove' ? 'profile.removeBody' : 'profile.transferBody') : ''}
          </KText>
          <Button
            label={pending ? t(pending.kind === 'remove' ? 'profile.remove' : 'profile.makeOwner') : ''}
            onPress={() => void confirm()}
          />
          <Button variant="secondary" label={t('profile.keep')} onPress={() => setPending(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}
