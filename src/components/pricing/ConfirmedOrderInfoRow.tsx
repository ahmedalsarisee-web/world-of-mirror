import React, {useMemo} from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dense?: boolean;
}

const ConfirmedOrderInfoRow: React.FC<Props> = ({icon, children, style, dense = false}) => {
  const {theme} = useTheme();
  const {row} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: row,
          alignItems: 'flex-start',
          gap: dense ? 4 : theme.spacing.xs,
          minWidth: 0,
        },
        icon: {
          marginTop: dense ? 0 : 1,
          flexShrink: 0,
        },
        content: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [row, theme],
  );

  return (
    <View style={[styles.row, style]}>
      <MaterialCommunityIcons
        name={icon}
        size={dense ? 12 : 15}
        color={theme.colors.icon}
        style={styles.icon}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

export default ConfirmedOrderInfoRow;
