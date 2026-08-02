import type {TextStyle} from 'react-native';
import type {ThemeType} from '@shared/theme/theme';
import type {AdminNotificationRecord} from '@app/stores/adminNotificationStore';
import type {TransactionType} from '@app/types/models';

const FINANCE_DEBIT_TYPES = new Set<TransactionType>(['paid', 'advance', 'ledger_debit']);

export function resolveAdminNotificationActorName(
  item: AdminNotificationRecord,
): string | undefined {
  switch (item.kind) {
    case 'finance': {
      const name = item.metadata?.finance?.actorName?.trim();
      return name || undefined;
    }
    case 'attendance': {
      const name = item.metadata?.attendance?.employeeName?.trim();
      return name || undefined;
    }
    case 'confirmed_order': {
      const name = item.metadata?.confirmedOrder?.actorName?.trim();
      return name || undefined;
    }
    case 'order_moved': {
      const name = item.metadata?.orderMove?.employeeName?.trim();
      return name || undefined;
    }
    case 'order_updated': {
      const name = item.metadata?.orderUpdated?.actorName?.trim();
      return name || undefined;
    }
    case 'order_deleted': {
      const name = item.metadata?.orderDeleted?.actorName?.trim();
      return name || undefined;
    }
    case 'mirror_warehouse': {
      const name = item.metadata?.mirrorWarehouse?.actorName?.trim();
      return name || undefined;
    }
    default:
      return undefined;
  }
}

export function getAdminNotificationActorHighlightStyle(theme: ThemeType): TextStyle {
  const isLightTheme = theme.colors.background === '#F8FAFC';
  return {
    color: isLightTheme ? '#1D4ED8' : '#93C5FD',
    fontWeight: '800',
    backgroundColor: isLightTheme ? '#DBEAFE' : '#1E3A5F',
  };
}

export function splitTextByActorName(text: string, actorName: string): string[] {
  if (!actorName.trim()) {
    return [text];
  }
  return text.split(actorName);
}

const NOTIFICATION_NUMBER_PATTERN = /[0-9]+(?:[.,][0-9]+)*/g;

export type NotificationTextToken =
  | {kind: 'text'; value: string}
  | {kind: 'number'; value: string};

export function tokenizeNotificationNumbers(text: string): NotificationTextToken[] {
  if (!text) {
    return [];
  }

  const tokens: NotificationTextToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(NOTIFICATION_NUMBER_PATTERN)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({kind: 'text', value: text.slice(lastIndex, index)});
    }

    tokens.push({kind: 'number', value});
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    tokens.push({kind: 'text', value: text.slice(lastIndex)});
  }

  return tokens.length > 0 ? tokens : [{kind: 'text', value: text}];
}

export function resolveFinanceNotificationAmountTone(
  item: AdminNotificationRecord,
): 'positive' | 'negative' | undefined {
  if (item.kind !== 'finance') {
    return undefined;
  }

  const finance = item.metadata?.finance;
  if (!finance) {
    return undefined;
  }

  if (typeof finance.amount === 'number' && Number.isFinite(finance.amount)) {
    return finance.amount >= 0 ? 'positive' : 'negative';
  }

  return FINANCE_DEBIT_TYPES.has(finance.transactionType) ? 'negative' : 'positive';
}

export function getAdminNotificationNumberHighlightStyle(
  theme: ThemeType,
  amountTone?: 'positive' | 'negative',
): TextStyle {
  if (amountTone === 'positive') {
    return {
      color: theme.colors.balancePositive,
      fontWeight: '800',
    };
  }

  if (amountTone === 'negative') {
    return {
      color: theme.colors.balanceNegative,
      fontWeight: '800',
    };
  }

  return {
    color: theme.status.error,
    fontWeight: '800',
  };
}
