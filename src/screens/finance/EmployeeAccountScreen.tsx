import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Text} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import FinanceCardScreen from '@app/components/finance/FinanceCardScreen';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFinanceCardHeaderMenu} from '@app/hooks/useFinanceCardHeaderMenu';
import {useTheme} from '@app/context/ThemeContext';
import {createTransaction, subscribeToUserTransactions} from '@app/services/transactions.service';
import {setUserBalance, subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {filterCashScopeTransactions, resolveAccountBalance} from '@app/utils/financeTotals';
import {canManageFinanceAccount, canViewFinanceAccount} from '@app/utils/financePermissions';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';
import {resolveCashCardLabel} from '@app/utils/financeLedgers';
import type {TransactionFormValues} from '@app/utils/validation';

type Route = RouteProp<FinanceStackParamList, 'EmployeeAccount'>;

const EmployeeAccountScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, isRTL} = useDirection();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exporting, setExporting] = useState(false);

  const canAccess = targetUser ? canViewFinanceAccount(currentUser, targetUser) : false;
  const canManage = targetUser ? canManageFinanceAccount(currentUser, targetUser) : false;
  const balanceLabel = resolveCashCardLabel(targetUser?.financeCardLabels, t);

  useEffect(() => {
    const unsubUser = subscribeToUser(userId, setTargetUser);
    return unsubUser;
  }, [userId]);

  useEffect(() => {
    if (!canAccess) {
      return;
    }
    const unsubTx = subscribeToUserTransactions(userId, setTransactions);
    return unsubTx;
  }, [userId, canAccess]);

  const cashTransactions = useMemo(
    () => filterCashScopeTransactions(transactions),
    [transactions],
  );

  const balance = useMemo(
    () => resolveAccountBalance(targetUser?.balance ?? 0, cashTransactions),
    [cashTransactions, targetUser?.balance],
  );

  useEffect(() => {
    if (!targetUser || cashTransactions.length === 0) {
      return;
    }

    const storedBalance = targetUser.balance ?? 0;
    if (Math.abs(balance - storedBalance) < 0.005) {
      return;
    }

    void setUserBalance(userId, balance);
  }, [balance, cashTransactions.length, targetUser, userId]);

  useFinanceCardHeaderMenu({
    title: balanceLabel,
    visible: false,
    onOpenMenu: () => {},
  });

  if (!targetUser) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </ScreenContainer>
    );
  }

  if (!canAccess) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.status.error}]}>{t('accessDenied')}</Text>
      </ScreenContainer>
    );
  }

  const handleCreateTransaction = async (type: 'received' | 'paid', values: TransactionFormValues) => {
    if (!canManage || !currentUser) {
      return;
    }
    await createTransaction(userId, type, values.amount, values.note ?? '', {
      createdByUserId: currentUser.id,
      createdByRole: currentUser.role,
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEmployeeAccountReport(targetUser, cashTransactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[EmployeeAccountScreen] export failed', error);
      Alert.alert(t('error'), t('exportFinanceFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <FinanceCardScreen
      accountTitle={userName}
      balanceLabel={balanceLabel}
      balance={balance}
      transactions={cashTransactions}
      canManage={canManage}
      targetUser={targetUser}
      currentUser={currentUser}
      onCreateTransaction={handleCreateTransaction}
      onExport={handleExport}
      exporting={exporting}
    />
  );
};

export default EmployeeAccountScreen;
