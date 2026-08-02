import React, {Suspense, useCallback, useEffect, useMemo} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  closeStandaloneOrderModal,
  useStandaloneOrderModalStore,
} from '@app/stores/standaloneOrderModalStore';
import {completeAdminNotificationReturnIfPending} from '@app/utils/adminNotificationSheetReturn';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';

const MirrorPricingConfirmedOrdersPanel = React.lazy(
  () => import('@app/components/pricing/MirrorPricingConfirmedOrdersPanel'),
);

const StandaloneOrderModal: React.FC = () => {
  const {theme} = useTheme();
  const {chevronBack} = useDirection();
  const order = useStandaloneOrderModalStore((state) => state.order);
  const loading = useStandaloneOrderModalStore((state) => state.loading);
  const visible = loading || order !== null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {flex: 1, padding: theme.spacing.md, paddingBottom: theme.spacing.xxl},
        loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
      }),
    [theme],
  );

  const handleClose = useCallback(() => {
    closeStandaloneOrderModal();
    completeAdminNotificationReturnIfPending();
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => subscription.remove();
  }, [handleClose, visible]);

  if (!visible) {
    return null;
  }

  const title = order ? formatMirrorOrderInvoiceLabel(order.invoiceNumber) : '';

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
        <ScreenHeader
          title={title}
          startAction={
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              style={({pressed}) => [{opacity: pressed ? 0.65 : 1}]}
            >
              <MaterialCommunityIcons name={chevronBack} size={24} color={theme.typography.primary} />
            </Pressable>
          }
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : order ? (
          <View style={styles.panel}>
            <Suspense
              fallback={
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              }
            >
              <MirrorPricingConfirmedOrdersPanel showTitle={false} standaloneOrder={order} />
            </Suspense>
          </View>
        ) : null}
      </ScreenContainer>
    </Modal>
  );
};

export default StandaloneOrderModal;
