/** Live Firestore listener caps — export/report paths may still load full history on demand. */
export const USER_TRANSACTIONS_LIVE_LIMIT = 2000;
export const ADMIN_TRANSACTIONS_LIVE_LIMIT = 3000;
export const FIRESTORE_IN_QUERY_CHUNK_SIZE = 10;
export const FIRESTORE_MAX_QUERY_LIMIT = 10_000;

/** In-memory order search / cache caps */
export const CONFIRMED_ORDERS_STORE_MAX = 600;
export const ORDERS_SEARCH_MAX_RESULTS = 1000;
