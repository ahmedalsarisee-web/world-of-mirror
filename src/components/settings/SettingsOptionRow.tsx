import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  icon: string;
  iconColor: string;
  iconBackground: string;
  label: string;
  value: string;
  onPress: () => void;
  showDivider?: boolean;
}

const SettingsOptionRow: React.FC<Props> = ({
  icon,
  iconColor,
  iconBackground,
  label,
  value,
  onPress,
  showDivider = false,
}) => {
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, layoutStyle, chevronForward} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: theme.colors.divider,
        },
        row: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        textWrap: {flex: 1, minWidth: 0},
        label: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        value: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
        },
      }),
    [row, showDivider, theme],
  );

  return (
    <View style={styles.wrap}>
      <Pressable style={[styles.row, layoutStyle]} onPress={onPress}>
        <View style={[styles.iconWrap, {backgroundColor: iconBackground}]}>
          <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, textStyle, {color: theme.typography.primary}]}>{label}</Text>
          <Text
            style={[styles.value, inlineTextStyle, {color: theme.typography.secondary}]}
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>
        <MaterialCommunityIcons name={chevronForward as any} size={20} color={theme.colors.icon} />
      </Pressable>
    </View>
  );
};

export default SettingsOptionRow;
