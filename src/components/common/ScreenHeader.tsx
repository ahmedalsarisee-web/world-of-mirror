import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavHeaderTitle} from '@app/components/navigation/AppNavText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

const ScreenHeader: React.FC<Props> = ({title, action, style}) => {
  const insets = useSafeAreaInsets();
  const {theme} = useTheme();
  const {row, layoutStyle, textAlign} = useDirection();

  return (
    <View
      style={[
        styles.header,
        layoutStyle,
        {
          flexDirection: row,
          borderBottomColor: theme.colors.divider,
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top + 12,
        },
        style,
      ]}
    >
      <NavHeaderTitle color={theme.typography.primary} style={{textAlign, flex: 1}}>
        {title}
      </NavHeaderTitle>
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    width: '100%',
  },
  actionWrap: {
    flexShrink: 0,
  },
});

export default ScreenHeader;
