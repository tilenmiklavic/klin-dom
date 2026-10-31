import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@klindom/ui';
import { pendingInvite } from '../../src/auth/pendingInvite';

/** Remembers the invite code so it survives sign-in. The confirmation UI lands in a later task. */
export default function Join() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  useEffect(() => {
    if (code) void pendingInvite.set(code);
  }, [code]);
  return <Screen title={t('join.title')}>{null}</Screen>;
}
