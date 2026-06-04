import React from 'react';
import {Platform, StyleSheet, Text, View, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  icon: string;
  label: string;
  detail?: string;
  trailingIcon?: string;
  selected?: boolean;
  labelActive?: boolean;
  style?: ViewStyle;
}

const OptionRow: React.FC<Props> = ({
  icon,
  label,
  detail,
  trailingIcon,
  selected,
  labelActive,
  style,
}) => {
  const {theme} = useTheme();
  const {inlineTextStyle, row, layoutStyle, appFont} = useDirection();
  const active = selected || labelActive;
  const iconColor = active ? theme.base.white : theme.typography.primary;
  const labelColor = active ? theme.base.white : theme.typography.primary;
  const detailColor = active ? theme.base.white : theme.typography.secondary;

  return (
    <View style={[styles.row, layoutStyle, {flexDirection: row}, style]}>
      <MaterialCommunityIcons name={icon as any} size={24} color={iconColor} />
      <View style={styles.textWrap}>
        <Text
          style={[
            styles.label,
            inlineTextStyle,
            appFont('bold'),
            {color: labelColor},
            Platform.OS === 'android' ? {includeFontPadding: false} : null,
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            style={[
              styles.detail,
              inlineTextStyle,
              appFont('regular'),
              {color: detailColor},
              Platform.OS === 'android' ? {includeFontPadding: false} : null,
            ]}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {trailingIcon ? (
        <MaterialCommunityIcons name={trailingIcon as any} size={24} color={theme.typography.secondary} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
  },
  detail: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default OptionRow;
