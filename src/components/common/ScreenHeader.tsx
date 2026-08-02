import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavHeaderTitle} from '@app/components/navigation/AppNavText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

export const HEADER_SIDE_INSET = 56;
const HEADER_ROW_MIN_HEIGHT = 44;
const HEADER_BOTTOM_PADDING = 12;

interface Props {
  title: string;
  startAction?: React.ReactNode;
  action?: React.ReactNode;
  leadingAction?: React.ReactNode;
  endAction?: React.ReactNode;
  style?: ViewStyle;
}

const ScreenHeader: React.FC<Props> = ({
  title,
  startAction,
  action,
  leadingAction,
  endAction,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const {row, alignStart, alignEnd} = useDirection();
  const {theme} = useTheme();
  const leftAction = leadingAction ?? startAction;
  const rightAction = endAction ?? action;

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: theme.colors.divider,
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top,
        },
        style,
      ]}
    >
      <View style={[styles.row, {flexDirection: row, paddingBottom: HEADER_BOTTOM_PADDING}]}>
        <View style={[styles.sideSlot, {alignItems: alignStart}]}>{leftAction}</View>
        <View style={styles.titleWrap}>
          <NavHeaderTitle color={theme.typography.primary}>{title}</NavHeaderTitle>
        </View>
        <View style={[styles.sideSlot, {alignItems: alignEnd}]}>{rightAction}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    width: '100%',
    borderBottomWidth: 1,
  },
  row: {
    alignItems: 'center',
    minHeight: HEADER_ROW_MIN_HEIGHT,
    paddingHorizontal: 8,
  },
  sideSlot: {
    flex: 1,
    minWidth: HEADER_SIDE_INSET,
    minHeight: HEADER_ROW_MIN_HEIGHT,
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 2,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});

export default ScreenHeader;
