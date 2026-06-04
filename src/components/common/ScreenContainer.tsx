import React from 'react';
import {ScrollView, StyleSheet, View, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

const ScreenContainer: React.FC<Props> = ({children, scroll = true, style, contentStyle}) => {
  const insets = useSafeAreaInsets();
  const {theme} = useTheme();
  const {layoutStyle} = useDirection();

  const containerStyle = [
    styles.container,
    layoutStyle,
    {backgroundColor: theme.backgrounds.background, paddingTop: insets.top},
    style,
  ];

  if (scroll) {
    return (
      <ScrollView
        style={containerStyle}
        contentContainerStyle={[styles.content, layoutStyle, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[containerStyle, styles.content, layoutStyle, contentStyle]}>{children}</View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 16, paddingBottom: 32},
});

export default ScreenContainer;
