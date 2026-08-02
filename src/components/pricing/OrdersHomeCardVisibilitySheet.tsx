import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import BottomSheet from '@app/components/common/BottomSheet';
import FinanceLedgerVisibilityPicker from '@app/components/finance/FinanceLedgerVisibilityPicker';
import type {AppUser} from '@app/types/models';

interface Props {
  visible: boolean;
  cardName?: string;
  users: AppUser[];
  initialSelectedIds: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (visibleToUserIds: string[]) => void | Promise<void>;
}

const OrdersHomeCardVisibilitySheet: React.FC<Props> = ({
  visible,
  cardName,
  users,
  initialSelectedIds,
  saving = false,
  onClose,
  onSave,
}) => {
  const {t} = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  useEffect(() => {
    if (visible) {
      setSelectedIds(initialSelectedIds);
    }
  }, [initialSelectedIds, visible]);

  const title = cardName
    ? t('ordersHomeCardVisibilityTitle', {name: cardName})
    : t('ordersHomeCardVisibility');

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <FinanceLedgerVisibilityPicker
        users={users}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
        labelKey="ordersHomeCardVisibility"
        hintKey="ordersHomeCardVisibilityHint"
        emptyKey="ordersHomeCardVisibilityEmpty"
      />
      <AppButton
        label={t('save')}
        onPress={() => onSave(selectedIds)}
        loading={saving}
      />
    </BottomSheet>
  );
};

export default OrdersHomeCardVisibilitySheet;
