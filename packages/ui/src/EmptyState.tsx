import { View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Button } from './Button';
import { Icon } from './Icon';
import { KText } from './Text';
import { tokens } from './tokens';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        gap: tokens.space[3],
        paddingVertical: tokens.space[8],
        paddingHorizontal: tokens.space[6],
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: tokens.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.surfaceSunken,
        }}
      >
        <Icon name={icon} size={24} />
      </View>
      <KText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </KText>
      <KText variant="body" color="inkMuted" style={{ textAlign: 'center' }}>
        {body}
      </KText>
      {action ? (
        <View style={{ marginTop: tokens.space[2] }}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
