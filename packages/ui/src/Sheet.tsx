import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KText } from './Text';
import { tokens } from './tokens';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

const MAX_WIDTH = 480;

export function Sheet({ visible, onClose, title, closeLabel, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          testID="sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20, 20, 20, 0.45)' }}
        />
        <View
          testID="sheet-panel"
          style={{
            width: '100%',
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
            maxHeight: '90%',
            backgroundColor: tokens.color.surfaceRaised,
            borderTopLeftRadius: tokens.radius.xl,
            borderTopRightRadius: tokens.radius.xl,
            paddingTop: tokens.space[5],
            paddingHorizontal: tokens.space[5],
            paddingBottom: Math.max(insets.bottom, tokens.space[4]),
            gap: tokens.space[4],
          }}
        >
          <KText variant="heading" accessibilityRole="header">
            {title}
          </KText>
          <ScrollView
            style={{ flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
