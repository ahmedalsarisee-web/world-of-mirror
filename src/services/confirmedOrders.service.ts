import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';

const MIRROR_CONFIRMED_ORDERS = 'mirrorConfirmedOrders';

function mapConfirmedOrder(id: string, data: Record<string, unknown>): MirrorPricingConfirmedOrder {
  return {
    id,
    customerName: String(data.customerName ?? ''),
    customerPhone: String(data.customerPhone ?? ''),
    customerLocation: String(data.customerLocation ?? ''),
    collectedAmount: Number(data.collectedAmount ?? 0),
    subtotal: data.subtotal === undefined ? undefined : Number(data.subtotal),
    discountAmount: data.discountAmount === undefined ? undefined : Number(data.discountAmount),
    total: Number(data.total ?? 0),
    remainingAmount: data.remainingAmount === undefined ? undefined : Number(data.remainingAmount),
    items: Array.isArray(data.items) ? (data.items as MirrorPricingConfirmedOrder['items']) : [],
    confirmedAt: String(data.confirmedAt ?? ''),
    confirmedByUserId: data.confirmedByUserId ? String(data.confirmedByUserId) : undefined,
  };
}

function sortOrders(orders: MirrorPricingConfirmedOrder[]): MirrorPricingConfirmedOrder[] {
  return [...orders].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
}

export function subscribeToConfirmedOrders(
  callback: (orders: MirrorPricingConfirmedOrder[]) => void,
): Unsubscribe {
  if (isMockMode) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(collection(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS), (snap) => {
    const orders = sortOrders(snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data())));
    callback(orders);
  });
}

export async function createConfirmedOrder(
  order: Omit<MirrorPricingConfirmedOrder, 'id' | 'confirmedAt'>,
  confirmedByUserId?: string,
): Promise<string> {
  if (isMockMode) {
    throw new Error('Confirmed orders are local-only in mock mode.');
  }

  const confirmedAt = new Date().toISOString();
  const payload = toFirestoreSafePayload({
    ...order,
    confirmedAt,
    ...(confirmedByUserId ? {confirmedByUserId} : {}),
  });

  const docRef = await addDoc(collection(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS), payload);
  return docRef.id;
}

export function getConfirmedOrderSaveErrorKey(error: unknown): string {
  const code = (error as {code?: string})?.code;
  if (code === 'permission-denied') {
    return 'confirmedOrderSavePermissionDenied';
  }
  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'confirmedOrderSaveOffline';
  }
  return 'saveFailed';
}

export async function deleteConfirmedOrder(orderId: string): Promise<void> {
  if (isMockMode) {
    return;
  }

  await deleteDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId));
}

export async function deleteAllConfirmedOrders(): Promise<void> {
  if (isMockMode) {
    return;
  }

  const snap = await getDocs(collection(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS));
  await Promise.all(snap.docs.map((entry) => deleteDoc(entry.ref)));
}
