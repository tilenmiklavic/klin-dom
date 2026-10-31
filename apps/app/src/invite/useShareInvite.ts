import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useToast } from '@klindom/ui';

/** Copies an invite link; the caller says so in its own UI. */
export function useCopyInviteLink() {
  return async (link: string) => {
    await Clipboard.setStringAsync(link);
  };
}

/** Opens the system share sheet for an invite link; falls back to copying the link. */
export function useShareInvite(homeName: string) {
  const { t } = useTranslation();
  const toast = useToast();
  return async (link: string) => {
    try {
      // Android ignores `url`, so its message carries the link; elsewhere the link rides along separately.
      const message = t(Platform.OS === 'android' ? 'invite.messageWithLink' : 'invite.message', { home: homeName, url: link });
      await Share.share({ message, url: link });
    } catch (error) {
      // Dismissing the browser's share sheet is not a failure.
      if (Platform.OS === 'web' && error instanceof Error && error.name === 'AbortError') return;
      await Clipboard.setStringAsync(link);
      toast.show({ message: t('invite.copied') });
    }
  };
}
