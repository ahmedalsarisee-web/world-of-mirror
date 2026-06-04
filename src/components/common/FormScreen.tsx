import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import {useHeaderHeight} from '@react-navigation/elements';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FormKeyboardProvider, useFormKeyboardRequired} from '@app/context/FormKeyboardContext';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  children: React.ReactNode;
  fields: string[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

const FormScreenContent: React.FC<Omit<Props, 'fields'>> = ({children, style, contentStyle}) => {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const {theme} = useTheme();
  const {layoutStyle} = useDirection();
  const {scrollRef} = useFormKeyboardRequired();

  const hasStackHeader = headerHeight > 0;
  const keyboardVerticalOffset = Platform.OS === 'ios' ? (hasStackHeader ? headerHeight : insets.top) : 0;
  const contentPaddingTop = hasStackHeader ? 0 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, {backgroundColor: theme.backgrounds.background}, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          layoutStyle,
          {
            paddingTop: contentPaddingTop,
            paddingBottom: Math.max(insets.bottom, 32) + 120,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const FormScreen: React.FC<Props> = ({fields, children, style, contentStyle}) => (
  <FormKeyboardProvider fields={fields}>
    <FormScreenContent style={style} contentStyle={contentStyle}>
      {children}
    </FormScreenContent>
  </FormKeyboardProvider>
);

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {paddingHorizontal: 16, flexGrow: 1},
});

export default FormScreen;
