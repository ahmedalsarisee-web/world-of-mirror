import React, {useCallback, useMemo, useState} from 'react';
import {Alert, BackHandler, ScrollView, StyleSheet} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import MirrorOrderFormSections from '@app/components/pricing/MirrorOrderFormSections';
import AddOrderInvoiceDetailsSection, {
  createInitialInvoiceExtraItemRows,
} from '@app/components/pricing/AddOrderInvoiceDetailsSection';
import OrderDestinationPickerSheet from '@app/components/pricing/OrderDestinationPickerSheet';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {
  getOrderStudioImageSaveErrorMessage,
  uploadOrderStudioImages,
} from '@app/services/orderStudioImages.service';
import {useDirection} from '@app/hooks/useDirection';
import {useOrdersHomeCards} from '@app/hooks/useOrdersHomeCards';
import {useAuthStore} from '@app/stores/authStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useOrdersHomeUiStore} from '@app/stores/ordersHomeUiStore';
import {isMockMode} from '@app/config/appMode';
import {
  buildConfirmedOrderRecord,
  createConfirmedOrderDraftId,
  getConfirmedOrderSaveErrorKey,
  persistConfirmedOrder,
} from '@app/services/confirmedOrders.service';
import {buildConfirmedByFieldsFromUser} from '@app/utils/confirmedOrderConfirmedBy';
import {
  getFirstMirrorCartCustomerFieldError,
  resolveMirrorCartCustomerFieldErrors,
  type MirrorCartCustomerFieldErrors,
  type MirrorCartCustomerFieldKey,
} from '@app/utils/mirrorCartCustomerInfo';
import {formatCustomerPhoneForStorage, formatSingleCustomerPhoneForStorage} from '@app/utils/customerPhone';
import {formatCurrency, roundMoney} from '@app/utils/format';
import {getNextMirrorOrderInvoiceNumber} from '@app/utils/mirrorOrderInvoiceNumber';
import {enableOrdersBackgroundSync} from '@app/utils/ordersSyncGate';
import {resolveOrdersHomeScreenCards} from '@app/types/ordersHomeCard';
import {filterVisibleOrdersHomeCards} from '@app/utils/ordersHomeCardVisibility';
import {pickImage, pickMultipleImages} from '@app/utils/imagePicker';
import {applyStudioImageReplaceToDraft} from '@app/utils/orderStudioImageReplace';
import {invalidateCatalogImageMarkerCache} from '@app/utils/catalogImageMarker';
import {
  pruneOrderImageAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {
  buildNewOrderDestinationFields,
  getAddOrderDestinationLabel,
  getAddOrderDestinations,
  getDefaultAddOrderDestinationKey,
} from '@app/utils/orderMoveDestinations';
import {consumeOrderOverlayBackPress} from '@app/utils/orderOverlayBackHandler';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';
import {
  normalizeInvoiceExportExtraLines,
  sumInvoiceExtraLineDrafts,
  type InvoiceExportExtraLineDraft,
} from '@app/types/invoiceExportExtraLine';

interface Props {
  onOrderConfirmed?: (destinationKey: string, orderId?: string) => void;
}

const MirrorPricingAddOrderPanel: React.FC<Props> = ({onOrderConfirmed}) => {
  const {t} = useTranslation();
  const {layoutStyle} = useDirection();
  const currentUser = useAuthStore((state) => state.user);
  const authEmail = useAuthStore((state) => state.authEmail);
  const addConfirmedOrder = useMirrorPricingConfirmedOrdersStore((state) => state.addOrder);
  const upsertOrders = useMirrorPricingConfirmedOrdersStore((state) => state.upsertOrders);
  const [savingOrder, setSavingOrder] = useState(false);
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  const [selectedCatalogImages, setSelectedCatalogImages] = useState<MirrorCatalogImageId[]>([]);
  const [catalogAnnotationData, setCatalogAnnotationData] = useState<CatalogMirrorImageAnnotationData>({});
  const [studioOrderImages, setStudioOrderImages] = useState<string[]>([]);
  const [uploadingStudio, setUploadingStudio] = useState(false);
  const [selectedDestinationKey, setSelectedDestinationKey] = useState(
    getDefaultAddOrderDestinationKey(),
  );

  const {cards: storedHomeCards} = useOrdersHomeCards();
  const allHomeCards = useMemo(
    () => resolveOrdersHomeScreenCards(storedHomeCards, t),
    [storedHomeCards, t],
  );
  const visibleHomeCards = useMemo(
    () => filterVisibleOrdersHomeCards(currentUser, authEmail, allHomeCards),
    [allHomeCards, authEmail, currentUser],
  );
  const addOrderDestinations = useMemo(
    () => getAddOrderDestinations(visibleHomeCards),
    [visibleHomeCards],
  );
  const selectedDestinationLabel = useMemo(
    () => getAddOrderDestinationLabel(selectedDestinationKey, visibleHomeCards, t),
    [selectedDestinationKey, t, visibleHomeCards],
  );

  useFocusEffect(
    useCallback(() => {
      const onHardwareBackPress = () => {
        if (consumeOrderOverlayBackPress()) {
          return true;
        }
        if (destinationSheetOpen) {
          setDestinationSheetOpen(false);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
      return () => subscription.remove();
    }, [destinationSheetOpen]),
  );

  const [customerName, setCustomerName] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<OrderFulfillmentType | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhone2, setCustomerPhone2] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [pieceCount, setPieceCount] = useState(0);
  const [collectedAmount, setCollectedAmount] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [invoiceExtraRows, setInvoiceExtraRows] = useState<InvoiceExportExtraLineDraft[]>(
    createInitialInvoiceExtraItemRows,
  );
  const [invoiceNote, setInvoiceNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<MirrorCartCustomerFieldErrors>({});

  const clearFieldError = useCallback((field: MirrorCartCustomerFieldKey) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = {...current};
      delete next[field];
      return next;
    });
  }, []);

  const translatedFieldErrors = useMemo(
    () => ({
      fulfillmentType: fieldErrors.fulfillmentType ? t(fieldErrors.fulfillmentType) : undefined,
      customerName: fieldErrors.customerName ? t(fieldErrors.customerName) : undefined,
      customerPhone: fieldErrors.customerPhone ? t(fieldErrors.customerPhone) : undefined,
      customerPhone2: fieldErrors.customerPhone2 ? t(fieldErrors.customerPhone2) : undefined,
      customerLocation: fieldErrors.customerLocation ? t(fieldErrors.customerLocation) : undefined,
    }),
    [fieldErrors, t],
  );

  const invoiceDetailsSubtotal = useMemo(
    () => sumInvoiceExtraLineDrafts(invoiceExtraRows),
    [invoiceExtraRows],
  );
  const hasInvoiceDetailsTotal = useMemo(
    () => normalizeInvoiceExportExtraLines(invoiceExtraRows).length > 0,
    [invoiceExtraRows],
  );
  const effectiveOrderTotal = hasInvoiceDetailsTotal ? invoiceDetailsSubtotal : orderTotal;

  const remainingAmount = useMemo(
    () => roundMoney(Math.max(0, effectiveOrderTotal - collectedAmount)),
    [collectedAmount, effectiveOrderTotal],
  );
  const remainingLabel = useMemo(
    () => formatCurrency(remainingAmount, t('currencyLabel')),
    [remainingAmount, t],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          flexGrow: 1,
        },
      }),
    [],
  );

  const resetForm = () => {
    setCustomerName('');
    setFulfillmentType(null);
    setCustomerPhone('');
    setCustomerPhone2('');
    setCustomerLocation('');
    setCustomerNotes('');
    setPieceCount(0);
    setCollectedAmount(0);
    setOrderTotal(0);
    setInvoiceExtraRows(createInitialInvoiceExtraItemRows());
    setInvoiceNote('');
    setSelectedCatalogImages([]);
    setCatalogAnnotationData({});
    setStudioOrderImages([]);
    setSelectedDestinationKey(getDefaultAddOrderDestinationKey());
    setFieldErrors({});
  };

  const handleAddStudioImages = useCallback(async () => {
    if (!currentUser?.id || uploadingStudio) {
      return;
    }

    const picked = await pickMultipleImages();
    if (!picked.length) {
      return;
    }

    setUploadingStudio(true);
    try {
      const urls = await uploadOrderStudioImages(picked, currentUser.id);
      setStudioOrderImages((current) => [...current, ...urls]);
    } catch (error) {
      Alert.alert(t('error'), getOrderStudioImageSaveErrorMessage(error));
    } finally {
      setUploadingStudio(false);
    }
  }, [currentUser?.id, t, uploadingStudio]);

  const handleReplaceStudioImage = useCallback(async (oldUrl: string) => {
    if (!currentUser?.id || uploadingStudio) {
      return;
    }

    const picked = await pickImage();
    if (!picked) {
      return;
    }

    setUploadingStudio(true);
    try {
      const uploadedUrls = await uploadOrderStudioImages([picked], currentUser.id);
      const newUrl = uploadedUrls[0];
      if (!newUrl) {
        Alert.alert(t('error'), t('mirrorCatalogImageReplaceFailed'));
        return;
      }

      const next = applyStudioImageReplaceToDraft({
        catalogImageIds: selectedCatalogImages,
        studioImageUrls: studioOrderImages,
        annotationData: catalogAnnotationData,
        oldUrl,
        newUrl,
      });
      invalidateCatalogImageMarkerCache(oldUrl);
      setStudioOrderImages(next.studioImageUrls);
      setCatalogAnnotationData(next.annotationData);
    } catch (error) {
      Alert.alert(t('error'), getOrderStudioImageSaveErrorMessage(error));
    } finally {
      setUploadingStudio(false);
    }
  }, [
    catalogAnnotationData,
    currentUser?.id,
    selectedCatalogImages,
    studioOrderImages,
    t,
    uploadingStudio,
  ]);

  const handleSelectDestination = (destinationKey: string) => {
    setSelectedDestinationKey(destinationKey);
    setDestinationSheetOpen(false);
  };

  const finishOrderConfirmation = useCallback(
    (destinationKey: string, orderId?: string) => {
      resetForm();
      useOrdersHomeUiStore.getState().bumpCardStatsRevision();
      // Navigate immediately — nested InteractionManager can hang while heavy
      // background work (orders sync/search corpus) keeps the JS queue busy.
      try {
        onOrderConfirmed?.(destinationKey, orderId);
      } catch (error) {
        console.warn('[MirrorPricingAddOrderPanel] post-confirm navigation failed', error);
      }
    },
    [onOrderConfirmed],
  );

  const submitConfirmedOrder = () => {
    void (async () => {
      setSavingOrder(true);
      try {
        const destinationFields = buildNewOrderDestinationFields(selectedDestinationKey);
        const confirmedAt = new Date().toISOString();
        const total = roundMoney(effectiveOrderTotal);
        const remaining = Math.max(0, total - collectedAmount);
        const savedInvoiceExtraLines = normalizeInvoiceExportExtraLines(invoiceExtraRows);
        const savedInvoiceNote = invoiceNote.trim() || undefined;
        const invoiceNumber = getNextMirrorOrderInvoiceNumber(
          useMirrorPricingConfirmedOrdersStore.getState().orders,
        );
        const orderSnapshot = {
          customerName,
          fulfillmentType: fulfillmentType ?? undefined,
          customerPhone: formatCustomerPhoneForStorage(customerPhone),
          customerPhone2: formatSingleCustomerPhoneForStorage(customerPhone2) || undefined,
          customerLocation,
          customerNotes: customerNotes.trim() || undefined,
          catalogMirrorImages:
            selectedCatalogImages.length > 0 ? [...selectedCatalogImages] : undefined,
          catalogMirrorImageAnnotationData:
            resolveMirrorPricingOrderStatus(destinationFields.status) === 'completed'
              ? undefined
              : pruneOrderImageAnnotationData(
                  selectedCatalogImages,
                  studioOrderImages,
                  catalogAnnotationData,
                ),
          studioOrderImages: studioOrderImages.length > 0 ? [...studioOrderImages] : undefined,
          pieceCount: pieceCount > 0 ? Math.round(pieceCount) : undefined,
          collectedAmount,
          subtotal: total > 0 ? total : undefined,
          total,
          remainingAmount: remaining > 0 ? remaining : undefined,
          items: [],
          status: destinationFields.status,
          homeCardId: destinationFields.homeCardId,
          statusChangedAt: confirmedAt,
          invoiceNumber,
          invoiceExtraLines:
            savedInvoiceExtraLines.length > 0 ? savedInvoiceExtraLines : undefined,
          invoiceNote: savedInvoiceNote,
          ...buildConfirmedByFieldsFromUser(currentUser),
        };

        const destinationKey = selectedDestinationKey;

        if (isMockMode) {
          addConfirmedOrder(orderSnapshot);
          const confirmedOrderId = useMirrorPricingConfirmedOrdersStore
            .getState()
            .orders.find((entry) => entry.invoiceNumber === invoiceNumber)?.id;
          finishOrderConfirmation(destinationKey, confirmedOrderId);
          return;
        }

        const orderId = createConfirmedOrderDraftId();
        const savedOrder = buildConfirmedOrderRecord(orderSnapshot, orderId, confirmedAt);
        upsertOrders([savedOrder]);
        enableOrdersBackgroundSync();
        finishOrderConfirmation(destinationKey, orderId);

        void persistConfirmedOrder(savedOrder).catch((error) => {
          console.warn('[MirrorPricingAddOrderPanel] background persist failed', error);
          const errorCode = (error as {code?: string})?.code;
          if (errorCode === 'permission-denied') {
            return;
          }
          Alert.alert(t('error'), t(getConfirmedOrderSaveErrorKey(error)));
        });
      } catch (error) {
        console.warn('[MirrorPricingAddOrderPanel confirmOrder]', error);
        Alert.alert(t('error'), t('saveFailed'));
      } finally {
        setSavingOrder(false);
      }
    })();
  };

  const confirmOrder = () => {
    const nextFieldErrors = resolveMirrorCartCustomerFieldErrors(
      {
        customerName,
        customerPhone,
        customerPhone2,
        customerLocation,
      },
      fulfillmentType,
    );
    const firstErrorKey = getFirstMirrorCartCustomerFieldError(nextFieldErrors);

    if (firstErrorKey) {
      setFieldErrors(nextFieldErrors);
      Alert.alert(t('error'), t(firstErrorKey));
      return;
    }

    setFieldErrors({});

    const attachedImageCount = selectedCatalogImages.length + studioOrderImages.length;

    Alert.alert(
      t('mirrorOrdersConfirmTitle'),
      attachedImageCount > 0
        ? `${t('addOrderConfirmMessage', {destination: selectedDestinationLabel})}\n\n${t('addOrderConfirmCatalogImagesNote', {count: attachedImageCount})}`
        : t('addOrderConfirmMessage', {destination: selectedDestinationLabel}),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('mirrorOrdersConfirmAction'),
          onPress: () => {
            submitConfirmedOrder();
          },
        },
      ],
    );
  };

  const hasDestinationOptions = addOrderDestinations.destinations.length > 0;

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.scroll, layoutStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <MirrorOrderFormSections
          disabled={savingOrder}
          customerName={customerName}
          onCustomerNameChange={(value) => {
            clearFieldError('customerName');
            setCustomerName(value);
          }}
          fulfillmentType={fulfillmentType}
          onFulfillmentTypeChange={(value) => {
            clearFieldError('fulfillmentType');
            setFulfillmentType(value);
          }}
          showFulfillmentType
          fulfillmentTypeError={translatedFieldErrors.fulfillmentType}
          customerNameError={translatedFieldErrors.customerName}
          customerPhoneError={translatedFieldErrors.customerPhone}
          customerPhone2Error={translatedFieldErrors.customerPhone2}
          customerLocationError={translatedFieldErrors.customerLocation}
          customerPhone={customerPhone}
          onCustomerPhoneChange={(value) => {
            clearFieldError('customerPhone');
            setCustomerPhone(value);
          }}
          customerPhone2={customerPhone2}
          onCustomerPhone2Change={(value) => {
            clearFieldError('customerPhone2');
            setCustomerPhone2(value);
          }}
          showSecondPhone
          customerLocation={customerLocation}
          onCustomerLocationChange={(value) => {
            clearFieldError('customerLocation');
            setCustomerLocation(value);
          }}
          customerNotes={customerNotes}
          onCustomerNotesChange={setCustomerNotes}
          showPhotosLink={false}
          pieceCount={pieceCount}
          onPieceCountChange={setPieceCount}
          collectedAmount={collectedAmount}
          onCollectedAmountChange={setCollectedAmount}
          fullPrice={effectiveOrderTotal}
          onFullPriceChange={setOrderTotal}
          fullPriceLocked={hasInvoiceDetailsTotal}
          remainingLabel={remainingLabel}
          selectedCatalogImages={selectedCatalogImages}
          onChangeSelectedCatalogImages={setSelectedCatalogImages}
          catalogAnnotationData={catalogAnnotationData}
          onChangeCatalogAnnotationData={setCatalogAnnotationData}
          studioOrderImages={studioOrderImages}
          onChangeStudioUrls={setStudioOrderImages}
          onAddStudioImages={() => {
            void handleAddStudioImages();
          }}
          onReplaceStudioImage={(imageUrl) => {
            void handleReplaceStudioImage(imageUrl);
          }}
          uploadingStudio={uploadingStudio}
          showDestination={hasDestinationOptions}
          destinationLabel={selectedDestinationLabel}
          onDestinationPress={() => setDestinationSheetOpen(true)}
          afterInvoice={
            <AddOrderInvoiceDetailsSection
              rows={invoiceExtraRows}
              onChangeRows={setInvoiceExtraRows}
              invoiceNote={invoiceNote}
              onInvoiceNoteChange={setInvoiceNote}
              disabled={savingOrder}
            />
          }
          primaryActionLabel={t('mirrorOrdersConfirmAction')}
          onPrimaryAction={confirmOrder}
          primaryActionDisabled={savingOrder}
          primaryActionLoading={savingOrder}
        />
      </ScrollView>

      <OrderDestinationPickerSheet
        visible={destinationSheetOpen}
        title={t('addOrderDestinationTitle')}
        destinations={addOrderDestinations.destinations}
        homeCards={visibleHomeCards}
        selectedDestinationKey={selectedDestinationKey}
        disabled={savingOrder}
        onClose={() => setDestinationSheetOpen(false)}
        onSelect={handleSelectDestination}
      />
    </>
  );
};

export default MirrorPricingAddOrderPanel;
