import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useToast } from '@klindom/ui';
import { useCreateHome, useRefreshBootstrap } from '../data/homes';
import { useCurrentHome } from '../state/currentHome';

/**
 * Creates the home, makes it current and moves on to the invite step.
 * We navigate before refreshing the bootstrap: once the user has a home the auth gate would otherwise
 * send them straight to the tabs, skipping the invite screen.
 */
export function useCreateHomeFlow() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { setHomeId } = useCurrentHome();
  const refresh = useRefreshBootstrap();
  return useCreateHome({
    onSuccess(home) {
      setHomeId(home.id);
      router.replace({ pathname: '/(onboarding)/invite', params: { homeId: home.id, homeName: home.name } });
      void refresh();
    },
    onError: () => toast.show({ message: t('errors.generic') }),
  });
}
