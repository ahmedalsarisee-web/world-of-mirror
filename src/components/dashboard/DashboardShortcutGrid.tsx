import React, {useMemo, type ComponentProps} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface DashboardShortcut {
  key: string;
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  accentColor?: string;
  label: string;
  description?: string;
  onPress: () => void;
}

interface Props {
  shortcuts: DashboardShortcut[];
  variant?: 'list' | 'grid';
}

const DashboardShortcutGrid: React.FC<Props> = ({shortcuts, variant = 'list'}) => {
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, chevronForward, centeredTextStyle} = useDirection();
  const isGrid = variant === 'grid';
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {
          gap: theme.spacing.sm,
        },
        item: {
          flexDirection: row,
          alignItems: 'center',
          padding: theme.spacing.md,
          gap: theme.spacing.md,
          borderStartWidth: 4,
        },
        iconWrap: {
          width: 46,
          height: 46,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
          gap: 2,
        },
        label: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        description: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 16,
        },
        chevronWrap: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
        },
        grid: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        gridItem: {
          flexGrow: 1,
          flexBasis: shortcuts.length > 2 ? '30%' : '46%',
          minWidth: shortcuts.length === 1 ? '100%' : 96,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          gap: theme.spacing.xs,
          borderTopWidth: 3,
        },
        gridIconWrap: {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
        gridLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          textAlign: 'center',
        },
      }),
    [row, shortcuts.length, theme],
  );

  if (isGrid) {
    return (
      <View style={[styles.grid, layoutStyle]}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.key}
            style={({pressed}) => [
              listCard,
              styles.gridItem,
              {
                opacity: pressed ? 0.82 : 1,
                borderTopColor: shortcut.accentColor ?? shortcut.iconColor,
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={shortcut.onPress}
          >
            <View style={[styles.gridIconWrap, {backgroundColor: shortcut.iconBackground}]}>
              <MaterialCommunityIcons name={shortcut.icon} size={22} color={shortcut.iconColor} />
            </View>
            <Text
              style={[styles.gridLabel, centeredTextStyle, {color: theme.typography.primary}]}
              numberOfLines={2}
            >
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {shortcuts.map((shortcut) => (
        <Pressable
          key={shortcut.key}
          style={({pressed}) => [
            listCard,
            styles.item,
            layoutStyle,
            {
              opacity: pressed ? 0.82 : 1,
              borderStartColor: shortcut.accentColor ?? shortcut.iconColor,
              backgroundColor: theme.colors.surface,
            },
          ]}
          onPress={shortcut.onPress}
        >
          <View style={[styles.iconWrap, {backgroundColor: shortcut.iconBackground}]}>
            <MaterialCommunityIcons name={shortcut.icon} size={22} color={shortcut.iconColor} />
          </View>
          <View style={styles.textWrap}>
            <Text style={[styles.label, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
              {shortcut.label}
            </Text>
            {shortcut.description ? (
              <Text
                style={[styles.description, textStyle, {color: theme.typography.secondary}]}
                numberOfLines={2}
              >
                {shortcut.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.chevronWrap}>
            <MaterialCommunityIcons
              name={chevronForward}
              size={18}
              color={theme.typography.muted}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
};

export default DashboardShortcutGrid;
