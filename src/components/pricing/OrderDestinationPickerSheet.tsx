import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  getMirrorPricingOrderMoveTargetIcon,
  type MirrorPricingOrderMoveTarget,
} from '@app/types/mirrorPricingOrderStatus';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {
  getOrderMoveDestinationLabel,
  getOrdersHomeMoveDestinationKey,
  type OrdersHomeMoveDestination,
} from '@app/utils/orderMoveDestinations';

interface Props {
  visible: boolean;
  title: string;
  destinations: OrdersHomeMoveDestination[];
  homeCards: OrdersHomeCardConfig[];
  selectedDestinationKey?: string;
  disabled?: boolean;
  onClose: () => void;
  onSelect: (destinationKey: string) => void;
}

const OrderDestinationPickerSheet: React.FC<Props> = ({
  visible,
  title,
  destinations,
  homeCards,
  selectedDestinationKey,
  disabled = false,
  onClose,
  onSelect,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {inlineTextStyle, chevronForward} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        optionsGrid: {
          gap: 8,
        },
        optionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: 12,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
        },
        optionLabel: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
      }),
    [theme],
  );

  const resolveStatusLabel = (target: MirrorPricingOrderMoveTarget): string =>
    getOrderMoveDestinationLabel(target, homeCards, t);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} showsScrollIndicator>
      <View style={styles.optionsGrid}>
        {destinations.map((destination) => {
          const destinationKey = getOrdersHomeMoveDestinationKey(destination);
          const isSelected = selectedDestinationKey === destinationKey;

          if (destination.kind === 'status') {
            return (
              <Pressable
                key={destinationKey}
                style={({pressed}) => [
                  styles.optionRow,
                  {
                    opacity: pressed ? 0.7 : 1,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.divider,
                    backgroundColor: isSelected ? theme.colors.surfaceSecondary : theme.colors.card,
                  },
                ]}
                onPress={() => onSelect(destinationKey)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{selected: isSelected}}
              >
                <MaterialCommunityIcons
                  name={getMirrorPricingOrderMoveTargetIcon(destination.target)}
                  size={20}
                  color={theme.colors.primary}
                />
                <Text
                  style={[styles.optionLabel, inlineTextStyle, {color: theme.typography.primary}]}
                >
                  {resolveStatusLabel(destination.target)}
                </Text>
                <MaterialCommunityIcons
                  name={isSelected ? 'check-circle' : chevronForward}
                  size={18}
                  color={isSelected ? theme.colors.primary : theme.colors.icon}
                />
              </Pressable>
            );
          }

          return (
            <Pressable
              key={destinationKey}
              style={({pressed}) => [
                styles.optionRow,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.divider,
                  backgroundColor: isSelected ? theme.colors.surfaceSecondary : theme.colors.card,
                },
              ]}
              onPress={() => onSelect(destinationKey)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{selected: isSelected}}
            >
              <MaterialCommunityIcons
                name="folder-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                style={[styles.optionLabel, inlineTextStyle, {color: theme.typography.primary}]}
              >
                {destination.card.name}
              </Text>
              <MaterialCommunityIcons
                name={isSelected ? 'check-circle' : chevronForward}
                size={18}
                color={isSelected ? theme.colors.primary : theme.colors.icon}
              />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

export default OrderDestinationPickerSheet;
