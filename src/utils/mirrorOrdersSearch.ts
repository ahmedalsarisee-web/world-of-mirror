import dayjs from 'dayjs';
import {toWesternDigits} from '@app/utils/numericInput';
import {
  getCustomerPhoneDigits,
  parseCustomerPhoneNumbers,
  sanitizeCustomerPhoneInput,
  sanitizeSingleCustomerPhoneInput,
} from '@app/utils/customerPhone';
import type {TFunction} from 'i18next';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {resolveMirrorPricingOrderStatusLabel} from '@app/utils/ordersHomeCardLabels';
import {resolveConfirmedByRoleLabel} from '@app/utils/confirmedOrderConfirmedBy';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {roundMoney} from '@app/utils/format';
import {ORDERS_SEARCH_MAX_RESULTS} from '@app/constants/performanceLimits';

export type OrdersSearchFieldKey =
  | 'invoice'
  | 'status'
  | 'customerName'
  | 'customerPhone'
  | 'customerLocation'
  | 'customerNotes'
  | 'customerPhotosLink'
  | 'item'
  | 'itemNote'
  | 'amount'
  | 'date'
  | 'confirmedBy';

export interface OrdersSearchResult {
  order: MirrorPricingConfirmedOrder;
  matchedFields: OrdersSearchFieldKey[];
  score: number;
}

const FIELD_LABEL_KEYS: Record<OrdersSearchFieldKey, string> = {
  invoice: 'ordersSearchFieldInvoice',
  status: 'ordersSearchFieldStatus',
  customerName: 'ordersSearchFieldCustomer',
  customerPhone: 'ordersSearchFieldPhone',
  customerLocation: 'ordersSearchFieldLocation',
  customerNotes: 'ordersSearchFieldNotes',
  customerPhotosLink: 'ordersSearchFieldPhotosLink',
  item: 'ordersSearchFieldItem',
  itemNote: 'ordersSearchFieldItemNote',
  amount: 'ordersSearchFieldAmount',
  date: 'ordersSearchFieldDate',
  confirmedBy: 'ordersSearchFieldConfirmedBy',
};

function normalizeQuery(query: string): string {
  return toWesternDigits(query).trim().toLowerCase();
}

const PHONE_SEARCH_EXTRA_CHAR_PATTERN = /[\d\s+(),،.\-/\\;:\u060C\n]/g;

export function isPhoneLikeOrdersSearchQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed || trimmed.replace(/\s+/g, '').startsWith('#')) {
    return false;
  }

  const western = toWesternDigits(trimmed);
  const digits = getCustomerPhoneDigits(western);
  if (!digits) {
    return false;
  }

  const withoutPhoneChars = western.replace(PHONE_SEARCH_EXTRA_CHAR_PATTERN, '');
  if (withoutPhoneChars.length > 0) {
    return false;
  }

  if (/[,;/\n\u060C]/.test(western)) {
    return true;
  }

  const normalized = sanitizeSingleCustomerPhoneInput(trimmed);
  return (
    normalized.startsWith('0') ||
    normalized.startsWith('7') ||
    digits.startsWith('962') ||
    digits.startsWith('00962')
  );
}

/** Normalizes phone-shaped search text like the add-order phone fields. */
export function sanitizeOrdersSearchInput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.replace(/\s+/g, '').startsWith('#')) {
    return text;
  }
  if (!isPhoneLikeOrdersSearchQuery(text)) {
    return text;
  }

  const western = toWesternDigits(text);
  if (/[,;/\n\u060C]/.test(western)) {
    return sanitizeCustomerPhoneInput(text);
  }

  return sanitizeSingleCustomerPhoneInput(text);
}

function resolvePhoneSearchTerms(searchQuery: string): string[] | null {
  if (!isPhoneLikeOrdersSearchQuery(searchQuery)) {
    return null;
  }

  const western = toWesternDigits(searchQuery);
  if (/[,;/\n\u060C]/.test(western)) {
    const numbers = parseCustomerPhoneNumbers(searchQuery);
    return numbers.length > 0 ? numbers : null;
  }

  const single = sanitizeSingleCustomerPhoneInput(searchQuery);
  return single ? [single] : null;
}

function collectOrderPhoneNumbers(order: MirrorPricingConfirmedOrder): string[] {
  const numbers = parseCustomerPhoneNumbers(order.customerPhone);
  const phone2 = order.customerPhone2?.trim()
    ? sanitizeSingleCustomerPhoneInput(order.customerPhone2)
    : '';
  if (phone2) {
    numbers.push(phone2);
  }
  return numbers;
}

function matchesCustomerPhone(
  order: MirrorPricingConfirmedOrder,
  query: string,
  phoneTerms: string[] | null,
): boolean {
  if (phoneTerms && phoneTerms.length > 0) {
    const orderPhones = collectOrderPhoneNumbers(order);
    return phoneTerms.some((term) => orderPhones.some((phone) => phone.includes(term)));
  }

  return (
    haystackIncludes(order.customerPhone, query) ||
    haystackIncludes(order.customerPhone2 ?? '', query)
  );
}

export function resolveRemoteInvoiceSearchDigits(searchQuery: string): string | null {
  const query = normalizeQuery(searchQuery);
  if (!query) {
    return null;
  }

  const fromHash = parseInvoiceNumberSearchQuery(query);
  if (fromHash !== null) {
    return fromHash;
  }

  const compact = query.replace(/\s+/g, '');
  if (/^\d{1,6}$/.test(compact)) {
    return compact;
  }

  return null;
}

export function shouldUseExactInvoiceRemoteSearch(searchQuery: string): boolean {
  const query = normalizeQuery(searchQuery);
  return parseInvoiceNumberSearchQuery(query) !== null;
}

export function localHasExactInvoiceMatch(
  orders: MirrorPricingConfirmedOrder[],
  digits: string,
): boolean {
  const invoiceNumber = Number.parseInt(digits, 10);
  if (!Number.isFinite(invoiceNumber) || invoiceNumber < 1) {
    return false;
  }
  return orders.some((order) => order.invoiceNumber === invoiceNumber);
}

/** True when the query is worth asking Firestore (not only the in-memory store). */
export function shouldUseRemoteOrdersSearch(searchQuery: string): boolean {
  const query = normalizeQuery(searchQuery);
  if (!query || query.replace(/\s+/g, '') === '#') {
    return false;
  }
  // Any non-empty search field can match old orders outside the local store.
  return query.replace(/\s+/g, '').length >= 1;
}

export function resolveRemoteOrdersSearchPhoneTerms(searchQuery: string): string[] | null {
  return resolvePhoneSearchTerms(searchQuery);
}

/**
 * Skip remote fetch only for exact "#invoice" hits already present locally.
 * Plain digits / names / phones still load the corpus so old orders appear.
 */
export function shouldSkipRemoteOrdersSearch(
  searchQuery: string,
  localOrders: MirrorPricingConfirmedOrder[],
  _localResults?: OrdersSearchResult[],
): boolean {
  if (!shouldUseExactInvoiceRemoteSearch(searchQuery)) {
    return false;
  }
  const invoiceDigits = resolveRemoteInvoiceSearchDigits(searchQuery);
  if (invoiceDigits && localHasExactInvoiceMatch(localOrders, invoiceDigits)) {
    return true;
  }

  return false;
}

function normalizeAmountQuery(query: string): string {
  return query.replace(/[,٬]/g, '').replace(/[^\d.-]/g, '').trim();
}

function getDateTokens(iso: string): string[] {
  const date = dayjs(iso);
  if (!date.isValid()) {
    return [];
  }

  return [
    date.format('YYYY-MM-DD'),
    date.format('DD/MM/YYYY'),
    date.format('DD-MM-YYYY'),
    date.format('DD MM YYYY'),
    date.format('DD MMM YYYY'),
    date.format('MMMM YYYY'),
    date.format('MMM YYYY'),
    date.format('YYYY'),
    date.format('MM'),
    date.format('DD'),
    date.format('HH:mm'),
    date.format('hh:mm A'),
  ].map((value) => value.toLowerCase());
}

function getAmountTokens(amount: number): string[] {
  const normalized = roundMoney(amount);
  const fixed = normalized.toFixed(2);
  return [
    String(normalized),
    fixed,
    fixed.replace('.', ','),
    normalized.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
  ].map((value) => value.toLowerCase());
}

function pushField(
  fields: OrdersSearchFieldKey[],
  field: OrdersSearchFieldKey,
  score: number,
  matched: boolean,
): number {
  if (!matched) {
    return score;
  }
  if (!fields.includes(field)) {
    fields.push(field);
  }
  return score + (field === 'invoice' ? 12 : field === 'customerName' ? 8 : 4);
}

function haystackIncludes(haystack: string, query: string): boolean {
  if (!query) {
    return false;
  }
  const normalized = haystack.trim().toLowerCase();
  return normalized.length > 0 && normalized.includes(query);
}

/** e.g. "#42" or "# 42" → invoice digits only; plain "#" → null */
function parseInvoiceNumberSearchQuery(query: string): string | null {
  const compact = query.replace(/\s+/g, '');
  if (!compact.startsWith('#')) {
    return null;
  }
  const digits = compact.slice(1);
  if (!digits || !/^\d+$/.test(digits)) {
    return null;
  }
  return digits;
}

function scoreOrderByInvoiceNumber(
  order: MirrorPricingConfirmedOrder,
  digitsQuery: string,
): {fields: OrdersSearchFieldKey[]; score: number} {
  const invoiceDigits = order.invoiceNumber ? String(order.invoiceNumber) : '';
  if (!invoiceDigits) {
    return {fields: [], score: 0};
  }

  if (invoiceDigits === digitsQuery) {
    return {fields: ['invoice'], score: 1000};
  }

  if (invoiceDigits.startsWith(digitsQuery)) {
    return {fields: ['invoice'], score: 100 + digitsQuery.length};
  }

  return {fields: [], score: 0};
}

function buildOrderHaystacks(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
  homeCards: OrdersHomeCardConfig[],
): string[] {
  const status = resolveMirrorPricingOrderStatus(order.status);
  const values = [
    order.customerName,
    order.customerPhone,
    order.customerPhone2 ?? '',
    order.customerLocation,
    order.customerNotes ?? '',
    order.customerPhotosLink ?? '',
    resolveMirrorPricingOrderStatusLabel(status, homeCards, t),
    formatMirrorOrderInvoiceLabel(order.invoiceNumber) ?? '',
    order.invoiceNumber ? String(order.invoiceNumber) : '',
    order.invoiceNumber ? `#${order.invoiceNumber}` : '',
    order.confirmedByUserName ?? '',
    order.confirmedByUserRole ? resolveConfirmedByRoleLabel(order.confirmedByUserRole, t) : '',
  ];

  for (const entry of order.customAdditions ?? []) {
    values.push(entry.label);
  }

  for (const item of order.items) {
    values.push(t(item.labelKey));
    values.push(item.note ?? '');
    values.push(`${item.lengthCm} x ${item.widthCm}`);
    values.push(`${item.lengthCm}×${item.widthCm}`);
  }

  for (const token of getDateTokens(order.confirmedAt)) {
    values.push(token);
  }

  for (const amount of [
    order.total,
    order.collectedAmount,
    order.remainingAmount ?? 0,
    order.subtotal ?? 0,
    order.discountAmount ?? 0,
  ]) {
    for (const token of getAmountTokens(amount)) {
      values.push(token);
    }
  }

  return values;
}

function scoreOrder(
  order: MirrorPricingConfirmedOrder,
  query: string,
  amountQuery: string,
  phoneTerms: string[] | null,
  t: TFunction,
  homeCards: OrdersHomeCardConfig[],
) {
  const fields: OrdersSearchFieldKey[] = [];
  let score = 0;
  const status = resolveMirrorPricingOrderStatus(order.status);

  const invoiceLabel = formatMirrorOrderInvoiceLabel(order.invoiceNumber) ?? '';
  const invoiceDigits = order.invoiceNumber ? String(order.invoiceNumber) : '';
  score = pushField(
    fields,
    'invoice',
    score,
    haystackIncludes(invoiceLabel, query) ||
      haystackIncludes(invoiceDigits, query) ||
      (query.startsWith('#') && haystackIncludes(invoiceDigits, query.slice(1))),
  );

  score = pushField(
    fields,
    'status',
    score,
    haystackIncludes(resolveMirrorPricingOrderStatusLabel(status, homeCards, t), query),
  );

  score = pushField(fields, 'customerName', score, haystackIncludes(order.customerName, query));
  score = pushField(
    fields,
    'customerPhone',
    score,
    matchesCustomerPhone(order, query, phoneTerms),
  );
  score = pushField(fields, 'customerLocation', score, haystackIncludes(order.customerLocation, query));
  score = pushField(fields, 'customerNotes', score, haystackIncludes(order.customerNotes ?? '', query));

  const confirmerHaystack = [
    order.confirmedByUserName ?? '',
    order.confirmedByUserRole ? resolveConfirmedByRoleLabel(order.confirmedByUserRole, t) : '',
  ].join(' ');
  score = pushField(fields, 'confirmedBy', score, haystackIncludes(confirmerHaystack, query));
  score = pushField(
    fields,
    'customerPhotosLink',
    score,
    haystackIncludes(order.customerPhotosLink ?? '', query),
  );

  for (const entry of order.customAdditions ?? []) {
    if (haystackIncludes(entry.label, query)) {
      score = pushField(fields, 'item', score, true);
    }
  }

  for (const item of order.items) {
    const itemHaystacks = [
      t(item.labelKey),
      item.note ?? '',
      `${item.lengthCm} x ${item.widthCm}`,
      `${item.lengthCm}×${item.widthCm}`,
    ];
    if (itemHaystacks.some((value) => haystackIncludes(value, query))) {
      score = pushField(fields, 'item', score, true);
    }
    if (haystackIncludes(item.note ?? '', query)) {
      score = pushField(fields, 'itemNote', score, true);
    }
  }

  const amountMatched =
    (amountQuery &&
      [
        order.total,
        order.collectedAmount,
        order.remainingAmount ?? 0,
        order.subtotal ?? 0,
      ].some((amount) => getAmountTokens(amount).some((token) => token.includes(amountQuery)))) ||
    [order.total, order.collectedAmount, order.remainingAmount ?? 0].some((amount) =>
      getAmountTokens(amount).some((token) => token.includes(query)),
    );
  score = pushField(fields, 'amount', score, amountMatched);

  const dateMatched = getDateTokens(order.confirmedAt).some((token) => token.includes(query));
  score = pushField(fields, 'date', score, dateMatched);

  if (fields.length === 0) {
    const mergedHaystack = buildOrderHaystacks(order, t, homeCards).join(' ').toLowerCase();
    if (mergedHaystack.includes(query)) {
      score = 1;
      fields.push('customerName');
    }
  }

  return {fields, score};
}

function sortSearchResults(results: OrdersSearchResult[]): OrdersSearchResult[] {
  return results
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.order.confirmedAt.localeCompare(a.order.confirmedAt);
    })
    .slice(0, ORDERS_SEARCH_MAX_RESULTS);
}

export function searchMirrorOrders(
  orders: MirrorPricingConfirmedOrder[],
  searchQuery: string,
  t: TFunction,
): OrdersSearchResult[] {
  const query = normalizeQuery(searchQuery);
  if (!query) {
    return [];
  }

  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);

  const compactQuery = query.replace(/\s+/g, '');
  if (compactQuery === '#') {
    return [];
  }

  const invoiceDigitsQuery = parseInvoiceNumberSearchQuery(query);
  if (invoiceDigitsQuery !== null) {
    const invoiceResults = orders
      .map((order) => {
        const {fields, score} = scoreOrderByInvoiceNumber(order, invoiceDigitsQuery);
        return {order, matchedFields: fields, score};
      })
      .filter((entry) => entry.score > 0 && entry.matchedFields.length > 0);

    const exactMatches = invoiceResults.filter((entry) => entry.score === 1000);
    return sortSearchResults(exactMatches.length > 0 ? exactMatches : invoiceResults);
  }

  const amountQuery = normalizeAmountQuery(query);
  const phoneTerms = resolvePhoneSearchTerms(searchQuery);

  return sortSearchResults(
    orders
      .map((order) => {
        const {fields, score} = scoreOrder(order, query, amountQuery, phoneTerms, t, homeCards);
        return {order, matchedFields: fields, score};
      })
      .filter((entry) => entry.score > 0 && entry.matchedFields.length > 0),
  );
}

export function mergeOrdersSearchWithRemoteOrders(
  localResults: OrdersSearchResult[],
  remoteOrders: MirrorPricingConfirmedOrder[],
  searchQuery: string,
  t: TFunction,
): OrdersSearchResult[] {
  const query = normalizeQuery(searchQuery);
  if (!query || remoteOrders.length === 0) {
    return localResults;
  }

  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);
  const byId = new Map(localResults.map((entry) => [entry.order.id, entry]));

  for (const order of remoteOrders) {
    if (byId.has(order.id)) {
      continue;
    }

    const invoiceDigitsQuery = resolveRemoteInvoiceSearchDigits(query);
    if (invoiceDigitsQuery !== null) {
      const {fields, score} = scoreOrderByInvoiceNumber(order, invoiceDigitsQuery);
      if (score > 0) {
        byId.set(order.id, {order, matchedFields: fields, score});
        continue;
      }
    }

    const amountQuery = normalizeAmountQuery(query);
    const phoneTerms = resolvePhoneSearchTerms(searchQuery);
    const {fields, score} = scoreOrder(order, query, amountQuery, phoneTerms, t, homeCards);
    if (score > 0 && fields.length > 0) {
      byId.set(order.id, {order, matchedFields: fields, score});
    }
  }

  return sortSearchResults([...byId.values()]);
}

export function formatOrdersSearchMatchSummary(
  matchedFields: OrdersSearchFieldKey[],
  t: TFunction,
  maxFields = 3,
): string {
  if (matchedFields.length === 0) {
    return '';
  }

  const labels = matchedFields
    .slice(0, maxFields)
    .map((field) => t(FIELD_LABEL_KEYS[field]));

  const suffix =
    matchedFields.length > maxFields
      ? ` +${matchedFields.length - maxFields}`
      : '';

  return `${labels.join(' · ')}${suffix}`;
}

export function getOrdersSearchFieldLabel(field: OrdersSearchFieldKey, t: TFunction): string {
  return t(FIELD_LABEL_KEYS[field]);
}

export function resolveOrdersSearchNavigationStatus(
  order: MirrorPricingConfirmedOrder,
): MirrorPricingOrderStatus {
  return resolveMirrorPricingOrderStatus(order.status);
}
