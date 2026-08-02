import type {ComponentProps} from 'react';
import type {MaterialCommunityIcons} from '@expo/vector-icons';
import type {TFunction} from 'i18next';

export const ORDERS_HOME_BUILTIN_TARGETS = [
  'add_order',
  'preparation',
  'ready_delivery',
  'ready_installation',
  'completed_outstanding',
  'completed',
] as const;

export type OrdersHomeBuiltinTarget = (typeof ORDERS_HOME_BUILTIN_TARGETS)[number];

export type OrdersHomeCardConfig =
  | {
      id: string;
      name: string;
      kind: 'builtin';
      subtitle: string;
      target: OrdersHomeBuiltinTarget;
      visibleToUserIds?: string[];
    }
  | {
      id: string;
      name: string;
      kind: 'custom';
      visibleToUserIds?: string[];
    };

export type OrdersHomeCardIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

const DEFAULT_BUILTIN_IDS: Record<OrdersHomeBuiltinTarget, string> = {
  add_order: 'add_order',
  preparation: 'preparation',
  ready_delivery: 'ready_delivery',
  ready_installation: 'ready_installation',
  completed_outstanding: 'completed_outstanding',
  completed: 'completed',
};

export const ORDERS_HOME_SCREEN_CARD_IDS = ['add_order', 'preparation', 'completed'] as const;

export function buildOrdersHomeScreenCards(t: TFunction): OrdersHomeCardConfig[] {
  const defaults = buildDefaultOrdersHomeCards(t);
  return ORDERS_HOME_SCREEN_CARD_IDS.map((id) => defaults.find((card) => card.id === id)!);
}

function isOrdersHomeScreenBuiltinCard(card: OrdersHomeCardConfig): boolean {
  return (
    isBuiltinOrdersHomeCard(card) &&
    ORDERS_HOME_SCREEN_CARD_IDS.includes(card.id as (typeof ORDERS_HOME_SCREEN_CARD_IDS)[number])
  );
}

export function isOrdersHomeScreenCard(card: OrdersHomeCardConfig): boolean {
  return isCustomOrdersHomeCard(card) || isOrdersHomeScreenBuiltinCard(card);
}

/** Cards in the orders home grid (add_order lives in the header only). */
export function getOrdersHomeScreenGridCards(cards: OrdersHomeCardConfig[]): OrdersHomeCardConfig[] {
  return cards.filter((card) => isOrdersHomeScreenCard(card) && !isAddOrderHomeCard(card));
}

export function resolveOrdersHomeScreenCards(
  stored: OrdersHomeCardConfig[] | null | undefined,
  t: TFunction,
): OrdersHomeCardConfig[] {
  const screenDefaults = buildOrdersHomeScreenCards(t);
  const allResolved = resolveOrdersHomeCards(stored, t);
  const screenCards = allResolved.filter(isOrdersHomeScreenCard);

  if (screenCards.length === 0) {
    return screenDefaults;
  }

  const existingIds = new Set(screenCards.map((card) => card.id));
  const merged = [...screenCards];

  for (const defaultCard of screenDefaults) {
    if (existingIds.has(defaultCard.id)) {
      continue;
    }

    const defaultIndex = screenDefaults.findIndex((card) => card.id === defaultCard.id);
    let insertAt = merged.length;

    for (let index = defaultIndex - 1; index >= 0; index -= 1) {
      const anchorId = screenDefaults[index].id;
      const anchorIndex = merged.findIndex((card) => card.id === anchorId);
      if (anchorIndex >= 0) {
        insertAt = anchorIndex + 1;
        break;
      }
    }

    merged.splice(insertAt, 0, defaultCard);
  }

  return merged;
}

function applyOrdersHomeGridOrder(
  allCards: OrdersHomeCardConfig[],
  orderedGridIds: string[],
): OrdersHomeCardConfig[] {
  const gridIdSet = new Set(orderedGridIds);
  const cardsById = new Map(allCards.map((card) => [card.id, card]));
  let gridIndex = 0;

  return allCards.map((card) => {
    if (!gridIdSet.has(card.id)) {
      return card;
    }
    const nextCard = cardsById.get(orderedGridIds[gridIndex]);
    gridIndex += 1;
    return nextCard ?? card;
  });
}

export function moveOrdersHomeScreenCard(
  allCards: OrdersHomeCardConfig[],
  screenCards: OrdersHomeCardConfig[],
  cardId: string,
  direction: 'up' | 'down',
): OrdersHomeCardConfig[] {
  const gridIds = getOrdersHomeScreenGridCards(screenCards).map((card) => card.id);
  const currentIndex = gridIds.indexOf(cardId);
  if (currentIndex < 0) {
    return allCards;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= gridIds.length) {
    return allCards;
  }

  const nextGridIds = [...gridIds];
  [nextGridIds[currentIndex], nextGridIds[targetIndex]] = [
    nextGridIds[targetIndex],
    nextGridIds[currentIndex],
  ];

  return applyOrdersHomeGridOrder(allCards, nextGridIds);
}

export function reorderOrdersHomeScreenCards(
  allCards: OrdersHomeCardConfig[],
  orderedGridIds: string[],
): OrdersHomeCardConfig[] {
  const gridCards = getOrdersHomeScreenGridCards(allCards);
  const validIds = new Set(gridCards.map((card) => card.id));
  const normalizedIds = orderedGridIds.filter((id) => validIds.has(id));

  for (const card of gridCards) {
    if (!normalizedIds.includes(card.id)) {
      normalizedIds.push(card.id);
    }
  }

  return applyOrdersHomeGridOrder(allCards, normalizedIds);
}

export function insertCustomOrdersHomeCard(
  allCards: OrdersHomeCardConfig[],
  newCard: Extract<OrdersHomeCardConfig, {kind: 'custom'}>,
  t: TFunction,
): OrdersHomeCardConfig[] {
  const screenCards = resolveOrdersHomeScreenCards(allCards, t);
  const gridCards = getOrdersHomeScreenGridCards(screenCards);
  const completedCard = gridCards.find(isCompletedOrdersHomeCard);

  if (!completedCard) {
    return [...allCards, newCard];
  }

  const completedIndex = allCards.findIndex((card) => card.id === completedCard.id);
  if (completedIndex < 0) {
    return [...allCards, newCard];
  }

  const nextCards = [...allCards];
  nextCards.splice(completedIndex, 0, newCard);
  return nextCards;
}

export function needsOrdersHomeScreenCardsSync(
  stored: OrdersHomeCardConfig[] | null | undefined,
  screenCards: OrdersHomeCardConfig[],
): boolean {
  if (!stored?.length) {
    return false;
  }

  const requiredIds = new Set<string>(ORDERS_HOME_SCREEN_CARD_IDS);
  const storedIds = new Set(stored.map((card) => card.id));

  if (ORDERS_HOME_SCREEN_CARD_IDS.some((id) => !storedIds.has(id))) {
    return true;
  }

  const hasExtraBuiltins = stored.some(
    (card) => isBuiltinOrdersHomeCard(card) && !requiredIds.has(card.id),
  );
  if (hasExtraBuiltins) {
    return true;
  }

  const storedCustomIds = stored
    .filter(isCustomOrdersHomeCard)
    .map((card) => card.id)
    .sort()
    .join('|');
  const screenCustomIds = screenCards
    .filter(isCustomOrdersHomeCard)
    .map((card) => card.id)
    .sort()
    .join('|');

  return storedCustomIds !== screenCustomIds;
}

export function buildDefaultOrdersHomeCards(t: TFunction): OrdersHomeCardConfig[] {
  const preparationName = t('mirrorOrdersConfirmed');
  return [
    {
      id: DEFAULT_BUILTIN_IDS.add_order,
      name: t('addOrder'),
      subtitle: t('ordersHomeAddOrderHint', {sectionName: preparationName}),
      target: 'add_order',
      kind: 'builtin',
    },
    {
      id: DEFAULT_BUILTIN_IDS.preparation,
      name: preparationName,
      subtitle: t('ordersHomeConfirmedHint'),
      target: 'preparation',
      kind: 'builtin',
    },
    {
      id: DEFAULT_BUILTIN_IDS.ready_delivery,
      name: t('mirrorOrdersReadyDelivery'),
      subtitle: t('ordersHomeReadyDeliveryHint'),
      target: 'ready_delivery',
      kind: 'builtin',
    },
    {
      id: DEFAULT_BUILTIN_IDS.ready_installation,
      name: t('mirrorOrdersReadyInstallation'),
      subtitle: t('ordersHomeReadyInstallationHint'),
      target: 'ready_installation',
      kind: 'builtin',
    },
    {
      id: DEFAULT_BUILTIN_IDS.completed_outstanding,
      name: t('mirrorOrdersCompletedOutstanding'),
      subtitle: t('ordersHomeCompletedOutstandingHint'),
      target: 'completed_outstanding',
      kind: 'builtin',
    },
    {
      id: DEFAULT_BUILTIN_IDS.completed,
      name: t('mirrorOrdersCompleted'),
      subtitle: t('ordersHomeCompletedHint'),
      target: 'completed',
      kind: 'builtin',
    },
  ];
}

function mergeMissingDefaultOrdersHomeCards(
  stored: OrdersHomeCardConfig[],
  defaults: OrdersHomeCardConfig[],
): OrdersHomeCardConfig[] {
  const storedIds = new Set(stored.map((card) => card.id));
  const missingDefaults = defaults.filter((card) => !storedIds.has(card.id));
  if (missingDefaults.length === 0) {
    return stored;
  }

  const merged = [...stored];
  for (const missing of missingDefaults) {
    const defaultIndex = defaults.findIndex((card) => card.id === missing.id);
    let insertAt = merged.length;

    for (let index = defaultIndex - 1; index >= 0; index -= 1) {
      const anchorId = defaults[index].id;
      const anchorIndex = merged.findIndex((card) => card.id === anchorId);
      if (anchorIndex >= 0) {
        insertAt = anchorIndex + 1;
        break;
      }
    }

    merged.splice(insertAt, 0, missing);
  }

  return merged;
}

export function hasMissingOrdersHomeBuiltinCards(
  stored: OrdersHomeCardConfig[] | null | undefined,
  t: TFunction,
): boolean {
  if (!stored?.length) {
    return false;
  }

  const defaults = buildDefaultOrdersHomeCards(t);
  const storedIds = new Set(stored.map((card) => card.id));
  return defaults.some((card) => !storedIds.has(card.id));
}

export function resolveOrdersHomeCards(
  stored: OrdersHomeCardConfig[] | null | undefined,
  t: TFunction,
): OrdersHomeCardConfig[] {
  const defaults = buildDefaultOrdersHomeCards(t);
  if (!stored || stored.length === 0) {
    return defaults;
  }

  const normalizedStored = stored.filter((card) => {
    if (isCustomOrdersHomeCard(card)) {
      return true;
    }
    return isBuiltinOrdersHomeCard(card) && defaults.some((entry) => entry.id === card.id);
  });

  return mergeMissingDefaultOrdersHomeCards(normalizedStored, defaults);
}

export function isCustomOrdersHomeCard(card: OrdersHomeCardConfig): card is Extract<
  OrdersHomeCardConfig,
  {kind: 'custom'}
> {
  return card.kind === 'custom';
}

export function isBuiltinOrdersHomeCard(card: OrdersHomeCardConfig): card is Extract<
  OrdersHomeCardConfig,
  {kind: 'builtin'}
> {
  return card.kind === 'builtin';
}

export function isAddOrderHomeCard(card: OrdersHomeCardConfig): boolean {
  return isBuiltinOrdersHomeCard(card) && card.target === 'add_order';
}

export function isCompletedOrdersHomeCard(card: OrdersHomeCardConfig): boolean {
  return isBuiltinOrdersHomeCard(card) && card.target === 'completed';
}

export function getOrdersHomeCardIcon(card: OrdersHomeCardConfig): OrdersHomeCardIcon {
  if (isCustomOrdersHomeCard(card)) {
    return 'folder-outline';
  }

  switch (card.target) {
    case 'add_order':
      return 'plus';
    case 'preparation':
      return 'clipboard-check-outline';
    case 'ready_delivery':
      return 'truck-delivery-outline';
    case 'ready_installation':
      return 'hammer-wrench';
    case 'completed_outstanding':
      return 'hand-coin-outline';
    default:
      return 'check-decagram-outline';
  }
}

export function createOrdersHomeCardId(): string {
  return `orders_card_${Date.now()}`;
}

export function createCustomOrdersHomeCard(name: string): Extract<OrdersHomeCardConfig, {kind: 'custom'}> {
  return {
    id: createOrdersHomeCardId(),
    name: name.trim(),
    kind: 'custom',
  };
}
