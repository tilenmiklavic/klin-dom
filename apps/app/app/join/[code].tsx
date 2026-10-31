import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@klindom/ui';
import { pendingInvite } from '../../src/auth/pendingInvite';
import { useAuth } from '../../src/auth/AuthProvider';
import { JoinPreview } from '../../src/components/JoinPreview';

/** Signed out: remembers the code so it survives sign-in. Signed in: previews the invite and joins. */
export default function Join() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useAuth();
  useEffect(() => {
    if (code && status === 'signedOut') void pendingInvite.set(code);
  }, [code, status]);
  if (status !== 'signedIn' || !code) return <Screen title={t('join.loading')}>{null}</Screen>;
  return <JoinPreview rawCode={code} />;
}
