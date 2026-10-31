import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KText } from './Text';
import { tokens } from './tokens';

export interface ScreenProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}

/** Clears the floating tab bar. */
const TAB_BAR_CLEARANCE = 110;
const MAX_WIDTH = 480;

export function Screen({ title, right, children, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = (
    <View
      testID="screen-content"
      style={{
        width: '100%',
        maxWidth: MAX_WIDTH,
        alignSelf: 'center',
        flexGrow: 1,
        paddingHorizontal: tokens.space[5],
        paddingBottom: TAB_BAR_CLEARANCE,
        gap: tokens.space[4],
      }}
    >
      {title || right ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.space[4],
            paddingTop: tokens.space[4],
          }}
        >
          {title ? (
            <KText variant="title" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
              {title}
            </KText>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <View
      testID="screen-root"
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: tokens.color.surface,
      }}
    >
      {scroll ? (
        <ScrollView
          testID="screen-scroll"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}
