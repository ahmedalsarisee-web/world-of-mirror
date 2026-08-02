import {collection, getDocs, limit, query, writeBatch} from 'firebase/firestore';
import {getFirebaseDb} from '@app/config/firebase';

const FIRESTORE_BATCH_LIMIT = 450;

/** Delete every document in a collection, paging until none remain. */
export async function deleteAllDocumentsInCollection(collectionPath: string): Promise<number> {
  const db = getFirebaseDb();
  let totalDeleted = 0;

  while (true) {
    const snap = await getDocs(
      query(collection(db, collectionPath), limit(FIRESTORE_BATCH_LIMIT)),
    );
    if (snap.empty) {
      break;
    }

    const batch = writeBatch(db);
    snap.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
    totalDeleted += snap.docs.length;
  }

  return totalDeleted;
}
