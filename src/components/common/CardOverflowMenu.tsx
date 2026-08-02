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

interface OverflowButtonProps {
  onPress: () => void;
  disabled?: boolean;
  size?: 'header' | 'inline';
}

export const FinanceCardOverflowButton: React.FC<OverflowButtonProps> = ({
  onPress,
  disabled,
  size = 'inline',
}) => {
  const {theme} = useTheme();
  const isHeader = size === 'header';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={isHeader ? 10 : 8}
      accessibilityRole="button"
      accessibilityLabel="financeCardOptions"
      style={({pressed}) => [
        isHeader ? styles.headerBtn : styles.inlineBtn,
        {
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="dots-vertical"
        size={isHeader ? 24 : 18}
        color={isHeader ? theme.typography.primary : theme.colors.icon}
      />
    </Pressable>
  );
};

export const FinanceCardOverflowHeaderButton: React.FC<OverflowButtonProps> = (props) => (
  <FinanceCardOverflowButton {...props} size="header" />
);

interface SheetProps {
  visible: boolean;
  items: FinanceCardMenuItem[];
  onClose: () => void;
  title?: string;
}

export const FinanceCardOptionsSheet: React.FC<SheetProps> = ({visible, items, onClose, title}) => {
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
    if (key === 'convertToMemo') {
      return 'note-text-outline';
    }
    if (key === 'convertToFinance') {
      return 'cash-multiple';
    }
    if (key === 'add') {
      return 'plus-circle-outline';
    }
    if (key === 'pricing') {
      return 'calculator-variant-outline';
    }
    if (key === 'financialReport') {
      return 'file-document-outline';
    }
    if (key === 'layoutList') {
      return 'view-list-outline';
    }
    if (key === 'layoutGrid') {
      return 'view-grid-outline';
    }
    if (key === 'warehouse') {
      return 'warehouse';
    }
    if (key === 'shiftHours') {
      return 'clock-outline';
    }
    if (key === 'resetSchedule') {
      return 'backup-restore';
    }
    return 'delete-sweep-outline';
  };

  return (
    <BottomSheet visible={visible} title={title ?? t('financeCardOptions')} onClose={onClose}>
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
  inlineBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
