import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type TextInputContentSizeChangeEventData,
  type TextInputProps,
  type TextInputSubmitEditingEventData,
  type ViewStyle,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useFormKeyboard} from '@app/context/FormKeyboardContext';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatNumericDisplay, parseNumericInput, sanitizeNumericText} from '@app/utils/numericInput';

interface Props extends Omit<TextInputProps, 'value'> {
  label: string;
  error?: string;
  fieldKey?: string;
  value?: string | number;
  /** Use with react-hook-form number fields — empty display instead of 0. */
  numeric?: boolean;
  /** When numeric, show 0 instead of an empty field (useful when editing existing values). */
  preserveZero?: boolean;
  onNumberChange?: (value: number) => void;
  /** Green checkmark inside the field (e.g. confirmed dimension). */
  showSuccess?: boolean;
  /** Smaller label and input for dense forms. */
  compact?: boolean;
  /** Multiline input grows with content instead of scrolling inside a fixed height. */
  autoGrow?: boolean;
  /** Force left-to-right text for numbers, phones, URLs, etc. */
  forceLtr?: boolean;
  containerStyle?: ViewStyle;
}

/** Pad keyboards hide Next/Done — use numeric so the return key appears on iOS. */
const KEYBOARD_TYPES_WITHOUT_RETURN = new Set(['number-pad', 'decimal-pad', 'phone-pad']);

function resolveKeyboardType(keyboardType: TextInputProps['keyboardType']): TextInputProps['keyboardType'] {
  if (keyboardType && KEYBOARD_TYPES_WITHOUT_RETURN.has(keyboardType)) {
    return 'numeric';
  }
  return keyboardType;
}

function resolveNumericDisplay(value: string | number | undefined | null, preserveZero?: boolean): string {
  if (preserveZero && (value === 0 || value === '0')) {
    return '0';
  }
  return formatNumericDisplay(value);
}

const AppInput = forwardRef<TextInput, Props>(function AppInput(
  {
    label,
    error,
    fieldKey,
    style,
    onFocus,
    onSubmitEditing,
    returnKeyType,
    blurOnSubmit,
    submitBehavior,
    keyboardType,
    value,
    onChangeText,
    numeric,
    preserveZero,
    onNumberChange,
    onBlur,
    secureTextEntry,
    selectTextOnFocus,
    showSuccess,
    compact = false,
    autoGrow = false,
    forceLtr = false,
    containerStyle,
    multiline,
    numberOfLines,
    onContentSizeChange,
    scrollEnabled,
    ...props
  },
  ref,
) {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, fontFamily, appFont, ltrTextStyle, inputTextStyle, isRTL} = useDirection();
  const keyboard = useFormKeyboard();
  const wrapperRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const isFocusedRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const [numericText, setNumericText] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPasswordField = Boolean(secureTextEntry);

  useImperativeHandle(ref, () => inputRef.current as TextInput);

  const moveCaretToEnd = (length: number) => {
    requestAnimationFrame(() => {
      inputRef.current?.setSelection(length, length);
    });
  };

  const selectAllText = (length: number) => {
    requestAnimationFrame(() => {
      if (length > 0) {
        inputRef.current?.setSelection(0, length);
      }
    });
  };

  const isMultiline = Boolean(multiline);
  const isAutoGrowMultiline = isMultiline && autoGrow;
  const autoGrowMinHeight = compact ? 40 : 96;
  const [autoGrowHeight, setAutoGrowHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!numeric || isFocusedRef.current) {
      return;
    }
    setNumericText(resolveNumericDisplay(value, preserveZero));
  }, [numeric, preserveZero, value]);

  useEffect(() => {
    if (!fieldKey || !keyboard) {
      return;
    }

    keyboard.registerField(fieldKey, inputRef, wrapperRef);
    return () => keyboard.unregisterField(fieldKey);
  }, [fieldKey, keyboard]);

  const fieldIndex = fieldKey && keyboard ? keyboard.fields.indexOf(fieldKey) : -1;
  const isRegistered = fieldIndex >= 0;
  const isLastField = isRegistered && fieldIndex === keyboard!.fields.length - 1;
  const resolvedReturnKeyType =
    returnKeyType ?? (isMultiline ? 'default' : isLastField ? 'done' : 'next');
  const resolvedBlurOnSubmit =
    blurOnSubmit ?? (isMultiline ? false : isLastField ? true : false);
  const resolvedSubmitBehavior =
    submitBehavior ?? (isMultiline ? 'newline' : isLastField ? 'blurAndSubmit' : 'submit');
  const resolvedKeyboardType = numeric ? 'decimal-pad' : resolveKeyboardType(keyboardType);
  const usesNumericLayout =
    numeric ||
    resolvedKeyboardType === 'numeric' ||
    resolvedKeyboardType === 'number-pad' ||
    resolvedKeyboardType === 'decimal-pad';
  const usesLtrInput =
    forceLtr ||
    usesNumericLayout ||
    keyboardType === 'url' ||
    keyboardType === 'email-address' ||
    keyboardType === 'phone-pad';
  const fieldTextStyle = usesLtrInput
    ? {...ltrTextStyle, textAlign: 'left', writingDirection: 'ltr'}
    : inputTextStyle;
  const labelTextStyle = usesLtrInput
    ? ltrTextStyle
    : {...inputTextStyle, alignSelf: 'stretch' as const, width: '100%' as const};
  const hasTrailingIcon = isPasswordField || showSuccess;
  const showNumericDraft = isFocused || isFocusedRef.current;
  const textValue = numeric
    ? showNumericDraft
      ? numericText
      : resolveNumericDisplay(value, preserveZero)
    : String(value ?? '');

  useEffect(() => {
    if (!isAutoGrowMultiline) {
      return;
    }
    if (!textValue.trim()) {
      setAutoGrowHeight(null);
    }
  }, [isAutoGrowMultiline, textValue]);

  const handleChangeText = (text: string) => {
    if (numeric && onNumberChange) {
      const sanitized = sanitizeNumericText(text);
      setNumericText(sanitized);
      onNumberChange(parseNumericInput(sanitized));
      moveCaretToEnd(sanitized.length);
      return;
    }
    onChangeText?.(text);
  };

  const handleFocus = (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    if (numeric) {
      isFocusedRef.current = true;
      const display = resolveNumericDisplay(value, preserveZero);
      setNumericText(display);
      setIsFocused(true);
      selectAllText(display.length);
    }
    if (fieldKey && keyboard) {
      keyboard.onFieldFocus(fieldKey);
    }
    onFocus?.(event);
  };

  const handleBlur: TextInputProps['onBlur'] = (event) => {
    if (numeric) {
      isFocusedRef.current = false;
      setIsFocused(false);
      setNumericText(resolveNumericDisplay(value, preserveZero));
    }
    onBlur?.(event);
  };

  const handleSubmitEditing = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    if (fieldKey && keyboard && !isMultiline) {
      if (isLastField) {
        Keyboard.dismiss();
      } else {
        keyboard.focusNext(fieldKey);
      }
    }
    onSubmitEditing?.(event);
  };

  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    if (isAutoGrowMultiline) {
      const contentHeight = Math.ceil(event.nativeEvent.contentSize.height);
      const verticalPadding = compact ? 16 : 24;
      setAutoGrowHeight(Math.max(autoGrowMinHeight, contentHeight + verticalPadding));
    }
    onContentSizeChange?.(event);
  };

  return (
    <View
      ref={wrapperRef}
      style={[styles.wrapper, compact ? styles.wrapperCompact : null, containerStyle]}
      collapsable={false}
    >
      <Text
        style={[
          styles.label,
          compact ? styles.labelCompact : null,
          labelTextStyle,
          appFont('semibold'),
          {color: error ? theme.status.error : theme.typography.secondary},
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={[styles.inputContainer, usesLtrInput ? styles.ltrInputContainer : null]}>
        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.colors.placeholder}
          returnKeyType={resolvedReturnKeyType}
          blurOnSubmit={resolvedBlurOnSubmit}
          submitBehavior={resolvedSubmitBehavior}
          keyboardType={resolvedKeyboardType}
          secureTextEntry={isPasswordField && !passwordVisible}
          value={textValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          multiline={multiline}
          numberOfLines={isAutoGrowMultiline ? undefined : numberOfLines}
          scrollEnabled={isAutoGrowMultiline ? false : scrollEnabled}
          onContentSizeChange={handleContentSizeChange}
          {...props}
          selectTextOnFocus={selectTextOnFocus ?? (numeric ? true : undefined)}
          style={[
            styles.input,
            compact ? styles.inputCompact : null,
            hasTrailingIcon ? (isRTL ? styles.inputWithToggleRtl : styles.inputWithToggle) : null,
            {
              color: theme.typography.primary,
              borderColor: error ? theme.status.error : theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground,
              borderRadius: theme.components.input.radius,
              minHeight: isAutoGrowMultiline ? autoGrowMinHeight : compact ? 40 : theme.components.input.height,
              fontFamily,
              ...appFont('medium'),
              ...fieldTextStyle,
            },
            isMultiline && !isAutoGrowMultiline
              ? compact
                ? styles.multilineCompact
                : styles.multiline
              : null,
            isAutoGrowMultiline ? (compact ? styles.multilineAutoGrowCompact : styles.multilineAutoGrow) : null,
            isAutoGrowMultiline && autoGrowHeight != null
              ? {height: autoGrowHeight, minHeight: autoGrowHeight}
              : null,
            style,
          ]}
        />
        {isPasswordField ? (
          <Pressable
            style={[styles.toggle, isRTL ? styles.toggleRtl : styles.toggleLtr]}
            onPress={() => setPasswordVisible((visible) => !visible)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? t('hidePassword') : t('showPassword')}
          >
            <MaterialCommunityIcons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.typography.secondary}
            />
          </Pressable>
        ) : null}
        {!isPasswordField && showSuccess ? (
          <View style={[styles.toggle, isRTL ? styles.toggleRtl : styles.toggleLtr]} pointerEvents="none">
            <MaterialCommunityIcons name="check-circle" size={22} color={theme.status.success} />
          </View>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, textStyle, {color: theme.status.error}]}>{error}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {marginBottom: 14},
  wrapperCompact: {marginBottom: 8},
  label: {fontSize: 13, marginBottom: 6},
  labelCompact: {fontSize: 12, marginBottom: 4},
  inputContainer: {
    position: 'relative',
  },
  ltrInputContainer: {
    direction: 'ltr',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  inputWithToggleRtl: {
    paddingLeft: 44,
  },
  toggle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  toggleLtr: {
    right: 0,
  },
  toggleRtl: {
    left: 0,
  },
  multiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  multilineCompact: {
    minHeight: 68,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  multilineAutoGrow: {
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  multilineAutoGrowCompact: {
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  error: {fontSize: 12, marginTop: 4},
});

export default AppInput;
