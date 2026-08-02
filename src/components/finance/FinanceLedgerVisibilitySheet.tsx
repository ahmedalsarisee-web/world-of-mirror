import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import BottomSheet from '@app/components/common/BottomSheet';
import FinanceLedgerVisibilityPicker from '@app/components/finance/FinanceLedgerVisibilityPicker';
import type {AppUser} from '@app/types/models';

interface Props {
  visible: boolean;
  ledgerName?: string;
  users: AppUser[];
  initialSelectedIds: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (visibleToUserIds: string[]) => void | Promise<void>;
}

const FinanceLedgerVisibilitySheet: React.FC<Props> = ({
  visible,
  ledgerName,
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

  const title = ledgerName
    ? t('financeLedgerVisibilityTitle', {name: ledgerName})
    : t('financeLedgerVisibility');

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <FinanceLedgerVisibilityPicker
        users={users}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />
      <AppButton label={t('save')} onPress={() => onSave(selectedIds)} loading={saving} />
    </BottomSheet>
  );
};

export default FinanceLedgerVisibilitySheet;
