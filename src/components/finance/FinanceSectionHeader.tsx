import React, {useMemo} from 'react';
import {StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  title: string;
  style?: ViewStyle;
  action?: React.ReactNode;
}

const FinanceSectionHeader: React.FC<Props> = ({title, style, action}) => {
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
          marginTop: theme.spacing.lg,
        },
        title: {
          flex: 1,
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
        },
      }),
    [row, theme],
  );

  return (
    <View style={[styles.wrap, layoutStyle, style]}>
      <Text style={[styles.title, textStyle, {color: theme.typography.secondary}]}>{title}</Text>
      {action}
    </View>
  );
};

export default FinanceSectionHeader;
