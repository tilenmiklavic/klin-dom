import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, KText, tokens } from '@klindom/ui';

interface Props {
  title: string;
  body: string;
  onRetry: () => void;
  retrying?: boolean;
}

/** The inline "couldn't load this" card with a Try again button. */
export function ErrorCard({ title, body, onRetry, retrying }: Props) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: tokens.space[3],
        padding: tokens.space[6],
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.color.surfaceRaised,
      }}
    >
      <KText variant="heading">{title}</KText>
      <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
        {body}
      </KText>
      <Button label={t('common.retry')} loading={retrying} onPress={onRetry} />
    </View>
  );
}
