import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

export interface AppConfirmAction {
  key: string;
  label: string;
  variant?: 'primary' | 'success' | 'danger' | 'info' | 'outline';
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  message: string;
  actions: AppConfirmAction[];
  onClose: () => void;
  cancelLabel?: string;
}

const AppConfirmSheet: React.FC<Props> = ({
  visible,
  title,
  message,
  actions,
  onClose,
  cancelLabel,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {gap: theme.spacing.md},
        message: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 22,
        },
        actions: {gap: theme.spacing.sm},
      }),
    [theme],
  );

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.content}>
        <Text style={[styles.message, textStyle, inlineTextStyle, {color: theme.typography.primary}]}>
          {message}
        </Text>
        <View style={styles.actions}>
          {actions.map((action) => (
            <AppButton
              key={action.key}
              label={action.label}
              variant={action.variant ?? 'primary'}
              onPress={action.onPress}
            />
          ))}
          <AppButton label={cancelLabel ?? t('cancel')} variant="outline" onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
};

export default AppConfirmSheet;
