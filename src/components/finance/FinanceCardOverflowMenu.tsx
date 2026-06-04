import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

export interface FinanceCardMenuItem {
  key: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface HeaderButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export const FinanceCardOverflowHeaderButton: React.FC<HeaderButtonProps> = ({onPress, disabled}) => {
  const {theme} = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      style={({pressed}) => [
        styles.headerBtn,
        {
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.typography.primary} />
    </Pressable>
  );
};

interface SheetProps {
  visible: boolean;
  items: FinanceCardMenuItem[];
  onClose: () => void;
}

export const FinanceCardOptionsSheet: React.FC<SheetProps> = ({visible, items, onClose}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        item: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        itemLabel: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
      }),
    [row, theme],
  );

  const iconForItem = (key: string, destructive?: boolean) => {
    if (destructive) {
      return 'delete-forever-outline';
    }
    if (key === 'rename') {
      return 'pencil-outline';
    }
    return 'delete-sweep-outline';
  };

  return (
    <BottomSheet visible={visible} title={t('financeCardOptions')} onClose={onClose}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          disabled={item.disabled}
          onPress={() => {
            onClose();
            item.onPress();
          }}
          style={({pressed}) => [
            styles.item,
            layoutStyle,
            item.disabled ? {opacity: 0.45} : pressed ? {opacity: 0.72} : null,
          ]}
        >
          <MaterialCommunityIcons
            name={iconForItem(item.key, item.destructive) as any}
            size={22}
            color={item.destructive ? theme.colors.danger : theme.colors.primary}
          />
          <Text
            style={[
              styles.itemLabel,
              textStyle,
              {color: item.destructive ? theme.colors.danger : theme.typography.primary},
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 4,
  },
});
