import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  getOrdersHomeCardIcon,
  type OrdersHomeCardConfig,
} from '@app/types/ordersHomeCard';

interface Props {
  visible: boolean;
  cards: OrdersHomeCardConfig[];
  saving?: boolean;
  onClose: () => void;
  onMove: (cardId: string, direction: 'up' | 'down') => void | Promise<void>;
}

const OrdersHomeCardsReorderSheet: React.FC<Props> = ({
  visible,
  cards,
  saving = false,
  onClose,
  onMove,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {row, textStyle} = useDirection();
  const [orderedIds, setOrderedIds] = useState<string[]>(cards.map((card) => card.id));

  useEffect(() => {
    if (visible) {
      setOrderedIds(cards.map((card) => card.id));
    }
  }, [cards, visible]);

  const cardsById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        hint: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
          marginBottom: theme.spacing.md,
        },
        list: {
          gap: theme.spacing.xs,
        },
        row: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          minHeight: 52,
        },
        iconWrap: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        title: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        actions: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        actionBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [row, theme],
  );

  const handleMove = (cardId: string, direction: 'up' | 'down') => {
    const currentIndex = orderedIds.indexOf(cardId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) {
      return;
    }

    const nextIds = [...orderedIds];
    [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];
    setOrderedIds(nextIds);
    void onMove(cardId, direction);
  };

  return (
    <BottomSheet visible={visible} title={t('ordersHomeCardsReorderTitle')} onClose={onClose}>
      <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
        {t('ordersHomeCardsReorderHint')}
      </Text>
      <View style={styles.list}>
        {orderedIds.map((cardId, index) => {
          const card = cardsById.get(cardId);
          if (!card) {
            return null;
          }

          const canMoveUp = index > 0 && !saving;
          const canMoveDown = index < orderedIds.length - 1 && !saving;

          return (
            <View
              key={card.id}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={[styles.iconWrap, {backgroundColor: theme.colors.surfaceSecondary}]}>
                <MaterialCommunityIcons
                  name={getOrdersHomeCardIcon(card)}
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <Text
                style={[styles.title, textStyle, {color: theme.typography.primary}]}
                numberOfLines={2}
              >
                {card.name}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => handleMove(card.id, 'up')}
                  disabled={!canMoveUp}
                  accessibilityRole="button"
                  accessibilityLabel={t('ordersHomeCardMoveUp')}
                  style={({pressed}) => [
                    styles.actionBtn,
                    {
                      backgroundColor: theme.colors.surfaceSecondary,
                      opacity: !canMoveUp ? 0.35 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chevron-up"
                    size={20}
                    color={theme.typography.primary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => handleMove(card.id, 'down')}
                  disabled={!canMoveDown}
                  accessibilityRole="button"
                  accessibilityLabel={t('ordersHomeCardMoveDown')}
                  style={({pressed}) => [
                    styles.actionBtn,
                    {
                      backgroundColor: theme.colors.surfaceSecondary,
                      opacity: !canMoveDown ? 0.35 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color={theme.typography.primary}
                  />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
};

export default OrdersHomeCardsReorderSheet;
