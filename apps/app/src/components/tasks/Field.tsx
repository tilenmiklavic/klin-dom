import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KText, tokens } from '@klindom/ui';

/** A labelled group of controls with an optional error line. */
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: tokens.space[2] }}>
      <KText variant="label" color="inkMuted" accessibilityRole="header" style={{ paddingHorizontal: tokens.space[2] }}>
        {label}
      </KText>
      {children}
      {error ? (
        <KText variant="caption" color="brandStrong" style={{ paddingHorizontal: tokens.space[2] }}>
          {error}
        </KText>
      ) : null}
    </View>
  );
}
