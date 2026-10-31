import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { IconName } from '@klindom/shared';
import { Button } from './Button';
import { Icon } from './Icon';
import { KText } from './Text';
import { tokens } from './tokens';

export interface InsightCardProps {
  icon?: IconName;
  children: ReactNode;
  dismissLabel: string;
  actionLabel: string;
  onDismiss: () => void;
  onAction: () => void;
}

export function InsightCard({
  icon = 'sparkle',
  children,
  dismissLabel,
  actionLabel,
  onDismiss,
  onAction,
}: InsightCardProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        gap: tokens.space[5],
        width: '100%',
        maxWidth: 360,
        marginTop: 32,
        paddingTop: 44,
        paddingHorizontal: tokens.space[6],
        paddingBottom: tokens.space[6],
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.color.brand,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: -32,
          alignSelf: 'center',
          width: 56,
          height: 56,
          borderRadius: tokens.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.onBrand,
          boxShadow: `0 0 0 6px ${tokens.color.surface}`,
        }}
      >
        <Icon name={icon} size={24} color="brand" />
      </View>
      <KText
        variant="heading"
        color="onBrand"
        style={{ textAlign: 'center', fontFamily: tokens.type.button.fontFamily, fontWeight: '600' }}
      >
        {children}
      </KText>
      <View style={{ flexDirection: 'row', gap: tokens.space[3], width: '100%' }}>
        <View style={{ flex: 1 }}>
          <Button variant="soft" label={dismissLabel} onPress={onDismiss} />
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="secondary" label={actionLabel} onPress={onAction} />
        </View>
      </View>
    </View>
  );
}
