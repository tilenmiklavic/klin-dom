import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { KText } from './Text';
import { tokens } from './tokens';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: tokens.space[2] }}>
      <KText variant="label" color="inkMuted" style={{ paddingHorizontal: tokens.space[2] }}>
        {label}
      </KText>
      <View
        testID="text-field-box"
        style={{
          height: 56,
          justifyContent: 'center',
          paddingHorizontal: tokens.space[6],
          borderRadius: tokens.radius.pill,
          backgroundColor: tokens.color.surfaceRaised,
          boxShadow: focused
            ? `${tokens.shadow.card}, 0 0 0 2px ${tokens.color.ink}`
            : tokens.shadow.card,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={tokens.color.inkSubtle}
          {...rest}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            ...tokens.type.body,
            color: tokens.color.ink,
            padding: 0,
            minWidth: 0,
            outlineWidth: 0,
          }}
        />
      </View>
      {error ? (
        <KText variant="caption" color="brandStrong" style={{ paddingHorizontal: tokens.space[2] }}>
          {error}
        </KText>
      ) : null}
    </View>
  );
}
