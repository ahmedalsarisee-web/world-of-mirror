import React, {useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FormKeyboardProvider, useFormKeyboardRequired} from '@app/context/FormKeyboardContext';
import {useLanguage} from '@app/context/LangContext';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: ViewStyle;
  formFields?: string[];
}

const BACKDROP_DELAY_MS = 350;

const BottomSheetScroll: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {layoutStyle} = useDirection();
  const {scrollRef} = useFormKeyboardRequired();

  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={layoutStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );
};

const BottomSheet: React.FC<Props> = ({visible, title, onClose, children, sheetStyle, formFields}) => {
  const {theme} = useTheme();
  const {language} = useLanguage();
  const insets = useSafeAreaInsets();
  const {inlineTextStyle, layoutStyle, appFont, textAlign, writingDirection} = useDirection();
  const openedAtRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      openedAtRef.current = Date.now();
    } else {
      setKeyboardHeight(0);
      Keyboard.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const bottomInset = keyboardHeight > 0 ? keyboardHeight : insets.bottom;

  const handleBackdropPress = () => {
    if (Date.now() - openedAtRef.current < BACKDROP_DELAY_MS) {
      return;
    }
    onClose();
  };

  const body = formFields?.length ? (
    <FormKeyboardProvider fields={formFields}>
      <BottomSheetScroll>{children}</BottomSheetScroll>
    </FormKeyboardProvider>
  ) : (
    <ScrollView
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={layoutStyle}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  );

  return (
    <Modal
      key={language}
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.overlay,
          layoutStyle,
          {backgroundColor: theme.colors.overlay, paddingBottom: bottomInset},
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityRole="button"
        />
        <View
          style={[
            styles.sheet,
            layoutStyle,
            keyboardHeight > 0 ? styles.sheetWithKeyboard : null,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.components.bottomTab.radius,
              borderTopRightRadius: theme.components.bottomTab.radius,
              paddingBottom: keyboardHeight > 0 ? 16 : Math.max(insets.bottom, 28),
            },
            sheetStyle,
          ]}
        >
          <View style={[styles.handle, {backgroundColor: theme.colors.divider}]} />
          <Text
            style={[
              styles.title,
              inlineTextStyle,
              appFont('bold'),
              {
                color: theme.typography.primary,
                textAlign,
                writingDirection,
                alignSelf: 'stretch',
              },
              Platform.OS === 'android' ? {includeFontPadding: false} : null,
            ]}
          >
            {title}
          </Text>
          {body}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    flexShrink: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetWithKeyboard: {
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    marginBottom: 16,
  },
});

export default BottomSheet;
