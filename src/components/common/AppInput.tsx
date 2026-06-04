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
  type TextInputProps,
  type TextInputSubmitEditingEventData,
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
    ...props
  },
  ref,
) {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textAlign, writingDirection, textStyle, fontFamily, appFont, ltrTextStyle, isRTL} = useDirection();
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
    returnKeyType ?? (isLastField ? 'done' : 'next');
  const resolvedBlurOnSubmit = blurOnSubmit ?? (isLastField ? true : false);
  const resolvedSubmitBehavior = submitBehavior ?? (isLastField ? 'blurAndSubmit' : 'submit');
  const resolvedKeyboardType = numeric ? 'decimal-pad' : resolveKeyboardType(keyboardType);
  const usesNumericLayout =
    numeric ||
    resolvedKeyboardType === 'numeric' ||
    resolvedKeyboardType === 'number-pad' ||
    resolvedKeyboardType === 'decimal-pad';
  const hasTrailingIcon = isPasswordField || showSuccess;
  const showNumericDraft = isFocused || isFocusedRef.current;
  const textValue = numeric
    ? showNumericDraft
      ? numericText
      : resolveNumericDisplay(value, preserveZero)
    : String(value ?? '');

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
      moveCaretToEnd(display.length);
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
    if (fieldKey && keyboard) {
      if (isLastField) {
        Keyboard.dismiss();
      } else {
        keyboard.focusNext(fieldKey);
      }
    }
    onSubmitEditing?.(event);
  };

  return (
    <View ref={wrapperRef} style={styles.wrapper} collapsable={false}>
      <Text
        style={[styles.label, textStyle, appFont('semibold'), {color: theme.typography.secondary}]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={styles.inputContainer}>
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
          {...props}
          selectTextOnFocus={numeric ? false : selectTextOnFocus}
          style={[
            styles.input,
            hasTrailingIcon ? (isRTL ? styles.inputWithToggleRtl : styles.inputWithToggle) : null,
            {
              color: theme.typography.primary,
              borderColor: error ? theme.status.error : theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground,
              borderRadius: theme.components.input.radius,
              minHeight: theme.components.input.height,
              fontFamily,
              ...appFont('medium'),
              ...(usesNumericLayout ? ltrTextStyle : {textAlign, writingDirection}),
            },
            props.multiline ? styles.multiline : null,
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
  label: {fontSize: 13, marginBottom: 6},
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
  error: {fontSize: 12, marginTop: 4},
});

export default AppInput;
