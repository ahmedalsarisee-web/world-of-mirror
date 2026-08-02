import {CommonActions} from '@react-navigation/native';
import {navigationRef} from '@app/RootNavigation';
import type {FinanceNotificationMetadata} from '@app/types/adminNotificationMetadata';
import type {FinanceStackParamList} from '@app/types/navigation';
import {isAdvanceTransactionType, isCustomLedgerTransactionType} from '@app/utils/transactionLabels';

type FinanceNotificationScreen = 'EmployeeAccount' | 'EmployeeAdvance' | 'EmployeeCustomLedger';

type FinanceNotificationTarget = {
  screen: FinanceNotificationScreen;
  params:
    | FinanceStackParamList['EmployeeAccount']
    | FinanceStackParamList['EmployeeAdvance']
    | FinanceStackParamList['EmployeeCustomLedger'];
};

export function resolveFinanceNotificationTarget(
  meta: FinanceNotificationMetadata,
): FinanceNotificationTarget {
  const focusTransactionId = meta.transactionId.trim() || undefined;
  const baseParams = {
    userId: meta.accountUserId,
    userName: meta.accountName,
    ...(focusTransactionId ? {focusTransactionId} : {}),
  };

  const ledgerId = meta.ledgerId?.trim();
  if (ledgerId || isCustomLedgerTransactionType(meta.transactionType)) {
    if (ledgerId) {
      return {
        screen: 'EmployeeCustomLedger',
        params: {
          ...baseParams,
          ledgerId,
          ledgerName: meta.ledgerName?.trim() || meta.accountName,
        },
      };
    }
  }

  if (isAdvanceTransactionType(meta.transactionType)) {
    return {
      screen: 'EmployeeAdvance',
      params: baseParams,
    };
  }

  return {
    screen: 'EmployeeAccount',
    params: {
      ...baseParams,
      card: 'cash',
    },
  };
}

export function navigateToFinanceNotificationTarget(
  meta: FinanceNotificationMetadata,
  options: {focusToken?: number} = {},
): boolean {
  if (!meta.accountUserId.trim()) {
    return false;
  }

  const target = resolveFinanceNotificationTarget(meta);
  const focusToken = options.focusToken ?? Date.now();
  const screenParams = {
    ...target.params,
    focusToken,
  };

  const dispatch = () => {
    navigationRef.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: {
          screen: 'FinanceTab',
          params: {
            state: {
              routes: [
                {name: 'FinanceHome'},
                {name: target.screen, params: screenParams},
              ],
              index: 1,
            },
          },
        },
      }),
    );
  };

  if (!navigationRef.isReady()) {
    setTimeout(dispatch, 120);
    return true;
  }

  dispatch();
  return true;
}
