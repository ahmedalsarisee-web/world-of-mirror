import {doc, getDoc, onSnapshot, setDoc, type Unsubscribe} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {useMockDb} from '@app/mock/mockDb';
import {
  ORDERS_HOME_BUILTIN_TARGETS,
  type OrdersHomeCardConfig,
  type OrdersHomeBuiltinTarget,
} from '@app/types/ordersHomeCard';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';

const APP_SETTINGS = 'appSettings';
const ORDERS_HOME_CARDS_DOC_ID = 'ordersHomeCards';

function isOrdersHomeBuiltinTarget(value: unknown): value is OrdersHomeBuiltinTarget {
  return typeof value === 'string' && ORDERS_HOME_BUILTIN_TARGETS.includes(value as OrdersHomeBuiltinTarget);
}

function parseVisibleToUserIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const ids = value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

function mapOrdersHomeCard(data: Record<string, unknown>): OrdersHomeCardConfig | null {
  const id = String(data.id ?? '').trim();
  const name = String(data.name ?? '').trim();
  if (!id || !name) {
    return null;
  }

  const visibleToUserIds = parseVisibleToUserIds(data.visibleToUserIds);

  if (data.kind === 'custom') {
    return {id, name, kind: 'custom', ...(visibleToUserIds ? {visibleToUserIds} : {})};
  }

  const target = data.target;
  if (!isOrdersHomeBuiltinTarget(target)) {
    return null;
  }

  return {
    id,
    name,
    kind: 'builtin',
    subtitle: String(data.subtitle ?? '').trim(),
    target,
    ...(visibleToUserIds ? {visibleToUserIds} : {}),
  };
}

function mapOrdersHomeCards(data: Record<string, unknown>): OrdersHomeCardConfig[] {
  const rawCards = data.cards;
  if (!Array.isArray(rawCards)) {
    return [];
  }

  return rawCards
    .map((entry) => mapOrdersHomeCard(entry as Record<string, unknown>))
    .filter((card): card is OrdersHomeCardConfig => card !== null);
}

export function subscribeToOrdersHomeCards(
  callback: (cards: OrdersHomeCardConfig[]) => void,
): Unsubscribe {
  if (isMockMode) {
    callback(useMockDb.getState().ordersHomeCards ?? []);
    return useMockDb.subscribe((state) => {
      callback(state.ordersHomeCards ?? []);
    });
  }

  const docRef = doc(getFirebaseDb(), APP_SETTINGS, ORDERS_HOME_CARDS_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        callback([]);
        return;
      }
      callback(mapOrdersHomeCards(snap.data() as Record<string, unknown>));
    },
    () => {
      callback([]);
    },
  );
}

export async function saveOrdersHomeCards(
  cards: OrdersHomeCardConfig[],
  updatedByUserId: string,
): Promise<void> {
  const payload = {
    cards,
    updatedAt: new Date().toISOString(),
    updatedByUserId,
  };

  if (isMockMode) {
    useMockDb.getState().setOrdersHomeCards(cards);
    return;
  }

  await setDoc(
    doc(getFirebaseDb(), APP_SETTINGS, ORDERS_HOME_CARDS_DOC_ID),
    toFirestoreSafePayload(payload),
    {merge: true},
  );
}

function stripUserFromOrdersHomeCard(
  card: OrdersHomeCardConfig,
  deletedUserId: string,
): OrdersHomeCardConfig {
  const visibleTo = card.visibleToUserIds;
  if (!visibleTo?.includes(deletedUserId)) {
    return card;
  }

  const nextVisibleTo = visibleTo.filter((id) => id !== deletedUserId);
  if (nextVisibleTo.length > 0) {
    return {...card, visibleToUserIds: nextVisibleTo};
  }

  const {visibleToUserIds: _removed, ...rest} = card;
  return rest;
}

function ordersHomeCardVisibilityChanged(
  before: OrdersHomeCardConfig,
  after: OrdersHomeCardConfig,
): boolean {
  const beforeIds = (before.visibleToUserIds ?? []).join(',');
  const afterIds = (after.visibleToUserIds ?? []).join(',');
  return beforeIds !== afterIds;
}

export async function removeDeletedUserFromOrdersHomeCards(deletedUserId: string): Promise<void> {
  if (!deletedUserId.trim()) {
    return;
  }

  if (isMockMode) {
    const cards = useMockDb.getState().ordersHomeCards ?? [];
    const nextCards = cards.map((card) => stripUserFromOrdersHomeCard(card, deletedUserId));
    const changed = nextCards.some((card, index) => ordersHomeCardVisibilityChanged(cards[index]!, card));
    if (changed) {
      useMockDb.getState().setOrdersHomeCards(nextCards);
    }
    return;
  }

  const docRef = doc(getFirebaseDb(), APP_SETTINGS, ORDERS_HOME_CARDS_DOC_ID);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return;
  }

  const cards = mapOrdersHomeCards(snap.data() as Record<string, unknown>);
  const nextCards = cards.map((card) => stripUserFromOrdersHomeCard(card, deletedUserId));
  const changed = nextCards.some((card, index) => {
    const before = cards[index];
    return before ? ordersHomeCardVisibilityChanged(before, card) : true;
  });

  if (!changed) {
    return;
  }

  await setDoc(
    docRef,
    toFirestoreSafePayload({
      cards: nextCards,
      updatedAt: new Date().toISOString(),
    }),
    {merge: true},
  );
}
