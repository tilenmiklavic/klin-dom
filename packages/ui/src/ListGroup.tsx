import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { KText } from './Text';
import { tokens } from './tokens';

export interface ListGroupProps {
  title?: string;
  children: ReactNode;
}

export function ListGroup({ title, children }: ListGroupProps) {
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: tokens.space[2] }}>
      {title ? (
        <KText
          variant="label"
          color="inkMuted"
          accessibilityRole="header"
          style={{ paddingHorizontal: tokens.space[2] }}
        >
          {title}
        </KText>
      ) : null}
      <View
        style={{
          overflow: 'hidden',
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.surfaceRaised,
          boxShadow: tokens.shadow.card,
        }}
      >
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: 1,
                  marginHorizontal: tokens.space[4],
                  backgroundColor: tokens.color.surfaceSunken,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}

export function ListRow({ label, value, onPress, destructive }: ListRowProps) {
  const content = (
    <>
      <KText
        variant="body"
        color={destructive ? 'brandStrong' : 'ink'}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {label}
      </KText>
      {value ? (
        <KText
          variant="body"
          color="inkMuted"
          numberOfLines={1}
          style={{ flexShrink: 1, textAlign: 'right' }}
        >
          {value}
        </KText>
      ) : null}
    </>
  );
  const style = {
    minHeight: 52,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: tokens.space[4],
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
  };
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}
