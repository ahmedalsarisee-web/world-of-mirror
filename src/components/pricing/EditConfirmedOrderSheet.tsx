import React, {useEffect, useMemo, useState} from 'react';
import {Alert, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import BottomSheet from '@app/components/common/BottomSheet';
import MirrorOrderFormSections from '@app/components/pricing/MirrorOrderFormSections';
import AddOrderInvoiceDetailsSection, {
  createInitialInvoiceExtraItemRows,
} from '@app/components/pricing/AddOrderInvoiceDetailsSection';
import EditConfirmedOrderCartItemsSection from '@app/components/pricing/EditConfirmedOrderCartItemsSection';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {
  getOrderStudioImageSaveErrorMessage,
  uploadOrderStudioImages,
} from '@app/services/orderStudioImages.service';
import {useAuthStore} from '@app/stores/authStore';
import type {MirrorPricingCartItem, MirrorPricingCustomAddition} from '@app/types/mirrorPricingCart';
import {
  getMirrorPricingCartDiscount,
  getMirrorPricingCartSubtotal,
  normalizeCartTotalOverride,
} from '@app/types/mirrorPricingCart';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {shouldPersistImageAnnotationsForOrderStatus} from '@app/types/mirrorPricingConfirmedOrder';
import {
  buildConfirmedOrderEditFields,
  buildConfirmedOrderPreview,
  type ConfirmedOrderEditDraftParams,
  type ConfirmedOrderEditFields,
} from '@app/utils/confirmedOrderEdit';
import {formatCurrency, roundMoney} from '@app/utils/format';
import {
  formatCustomerPhoneForStorage,
  formatSingleCustomerPhoneForStorage,
} from '@app/utils/customerPhone';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';
import {
  getFirstMirrorCartCustomerFieldError,
  resolveMirrorCartCustomerFieldErrors,
} from '@app/utils/mirrorCartCustomerInfo';
import type {CatalogMirrorImageAnnotationData} from '@app/utils/catalogImageTextAnnotations';
import {pickImage, pickMultipleImages} from '@app/utils/imagePicker';
import {applyStudioImageReplaceToDraft} from '@app/utils/orderStudioImageReplace';
import {invalidateCatalogImageMarkerCache} from '@app/utils/catalogImageMarker';
import {
  invoiceExportExtraLinesToDrafts,
  normalizeInvoiceExportExtraLines,
  sumInvoiceExtraLineDrafts,
  type InvoiceExportExtraLineDraft,
} from '@app/types/invoiceExportExtraLine';

interface Props {
  order: MirrorPricingConfirmedOrder | null;
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (orderId: string, fields: ConfirmedOrderEditFields) => void | Promise<void>;
  onPreviewChange?: (preview: MirrorPricingConfirmedOrder | null) => void;
}

const EditConfirmedOrderSheet: React.FC<Props> = ({
  order,
  visible,
  saving = false,
  onClose,
  onSave,
  onPreviewChange,
}) => {
  const {t} = useTranslation();
  const currentUser = useAuthStore((state) => state.user);

  const [customerName, setCustomerName] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<OrderFulfillmentType | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhone2, setCustomerPhone2] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [customerPhotosLink, setCustomerPhotosLink] = useState('');
  const [pieceCount, setPieceCount] = useState(0);
  const [collectedAmount, setCollectedAmount] = useState(0);
  const [totalInput, setTotalInput] = useState(0);
  const [items, setItems] = useState<MirrorPricingCartItem[]>([]);
  const [customAdditions, setCustomAdditions] = useState<MirrorPricingCustomAddition[]>([]);
  const [catalogMirrorImages, setCatalogMirrorImages] = useState<MirrorCatalogImageId[]>([]);
  const [catalogMirrorImageAnnotationData, setCatalogMirrorImageAnnotationData] =
    useState<CatalogMirrorImageAnnotationData>({});
  const [studioOrderImages, setStudioOrderImages] = useState<string[]>([]);
  const [uploadingStudio, setUploadingStudio] = useState(false);
  const [invoiceExtraRows, setInvoiceExtraRows] = useState<InvoiceExportExtraLineDraft[]>(
    createInitialInvoiceExtraItemRows,
  );
  const [invoiceNote, setInvoiceNote] = useState('');

  useEffect(() => {
    if (!order || !visible) {
      return;
    }
    setCustomerName(order.customerName);
    setFulfillmentType(order.fulfillmentType ?? null);
    setCustomerPhone(order.customerPhone);
    setCustomerPhone2(order.customerPhone2 ?? '');
    setCustomerLocation(order.customerLocation);
    setCustomerNotes(order.customerNotes ?? '');
    setCustomerPhotosLink(order.customerPhotosLink ?? '');
    setPieceCount(order.pieceCount ?? 0);
    setCollectedAmount(order.collectedAmount);
    setTotalInput(order.total);
    setItems(order.items.map((item) => ({...item})));
    setCustomAdditions((order.customAdditions ?? []).map((entry) => ({...entry})));
    setCatalogMirrorImages((order.catalogMirrorImages ?? []) as MirrorCatalogImageId[]);
    setCatalogMirrorImageAnnotationData(
      shouldPersistImageAnnotationsForOrderStatus(order.status)
        ? (order.catalogMirrorImageAnnotationData ?? {})
        : {},
    );
    setStudioOrderImages(order.studioOrderImages ?? []);
    setInvoiceExtraRows(invoiceExportExtraLinesToDrafts(order.invoiceExtraLines));
    setInvoiceNote(order.invoiceNote ?? '');
  }, [order, visible]);

  const subtotal = useMemo(
    () => getMirrorPricingCartSubtotal(items, customAdditions),
    [customAdditions, items],
  );
  const cartTotalOverride = useMemo(
    () => normalizeCartTotalOverride(totalInput, subtotal),
    [subtotal, totalInput],
  );
  const discountAmount = useMemo(
    () => getMirrorPricingCartDiscount(items, cartTotalOverride, customAdditions),
    [cartTotalOverride, customAdditions, items],
  );
  const hasCartItems = items.length > 0 || customAdditions.length > 0;
  const invoiceDetailsSubtotal = useMemo(
    () => sumInvoiceExtraLineDrafts(invoiceExtraRows),
    [invoiceExtraRows],
  );
  const hasInvoiceDetailsTotal = useMemo(
    () => normalizeInvoiceExportExtraLines(invoiceExtraRows).length > 0,
    [invoiceExtraRows],
  );
  const effectiveTotalInput = useMemo(() => {
    if (!hasCartItems && hasInvoiceDetailsTotal) {
      return invoiceDetailsSubtotal;
    }
    return totalInput;
  }, [hasCartItems, hasInvoiceDetailsTotal, invoiceDetailsSubtotal, totalInput]);
  const remainingAmount = useMemo(
    () => roundMoney(Math.max(0, effectiveTotalInput - collectedAmount)),
    [collectedAmount, effectiveTotalInput],
  );
  const remainingLabel = useMemo(
    () => formatCurrency(remainingAmount, t('currencyLabel')),
    [remainingAmount, t],
  );

  const editDraftParams = useMemo((): ConfirmedOrderEditDraftParams => {
    const hasCartItems = items.length > 0 || customAdditions.length > 0;
    const invoiceDetailsSubtotal = sumInvoiceExtraLineDrafts(invoiceExtraRows);
    const hasInvoiceDetailsTotal = normalizeInvoiceExportExtraLines(invoiceExtraRows).length > 0;
    const effectiveTotalInput =
      !hasCartItems && hasInvoiceDetailsTotal ? invoiceDetailsSubtotal : totalInput;

    return {
      customerName,
      fulfillmentType: fulfillmentType ?? undefined,
      customerPhone,
      customerPhone2,
      customerLocation,
      customerNotes,
      customerPhotosLink,
      catalogMirrorImages,
      catalogMirrorImageAnnotationData,
      studioOrderImages,
      pieceCount,
      collectedAmount,
      totalInput: effectiveTotalInput,
      items,
      customAdditions,
      status: order?.status,
      invoiceExtraRows,
      invoiceNote,
    };
  }, [
    catalogMirrorImageAnnotationData,
    catalogMirrorImages,
    collectedAmount,
    customAdditions,
    customerLocation,
    customerName,
    customerNotes,
    customerPhone,
    customerPhone2,
    customerPhotosLink,
    fulfillmentType,
    invoiceExtraRows,
    invoiceNote,
    items,
    order?.status,
    pieceCount,
    studioOrderImages,
    totalInput,
  ]);

  useEffect(() => {
    if (!order || !visible || !onPreviewChange) {
      return;
    }
    onPreviewChange(buildConfirmedOrderPreview(order, editDraftParams));
  }, [editDraftParams, onPreviewChange, order, visible]);

  useEffect(() => {
    if (visible || !onPreviewChange) {
      return;
    }
    onPreviewChange(null);
  }, [onPreviewChange, visible]);

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === id ? {...entry, quantity: Math.max(1, Math.round(quantity))} : entry,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
  };

  const updateCustomAdditionQuantity = (id: string, quantity: number) => {
    setCustomAdditions((current) =>
      current.map((entry) =>
        entry.id === id ? {...entry, quantity: Math.max(1, Math.round(quantity))} : entry,
      ),
    );
  };

  const handleAddStudioImages = async () => {
    if (!currentUser?.id || uploadingStudio || saving) {
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
  };

  const handleReplaceStudioImage = async (oldUrl: string) => {
    if (!currentUser?.id || uploadingStudio || saving) {
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
        catalogImageIds: catalogMirrorImages,
        studioImageUrls: studioOrderImages,
        annotationData: catalogMirrorImageAnnotationData,
        oldUrl,
        newUrl,
      });
      invalidateCatalogImageMarkerCache(oldUrl);
      setStudioOrderImages(next.studioImageUrls);
      setCatalogMirrorImageAnnotationData(next.annotationData);
    } catch (error) {
      Alert.alert(t('error'), getOrderStudioImageSaveErrorMessage(error));
    } finally {
      setUploadingStudio(false);
    }
  };

  const handleSave = () => {
    if (!order || saving) {
      return;
    }

    const fieldErrors = resolveMirrorCartCustomerFieldErrors(
      {
        customerName,
        customerPhone,
        customerPhone2,
        customerLocation,
      },
      fulfillmentType,
    );
    const firstErrorKey = getFirstMirrorCartCustomerFieldError(fieldErrors);
    if (firstErrorKey) {
      Alert.alert(t('error'), t(firstErrorKey));
      return;
    }

    void (async () => {
      const fields = buildConfirmedOrderEditFields({
        ...editDraftParams,
        fulfillmentType,
        customerPhone: formatCustomerPhoneForStorage(customerPhone),
        customerPhone2: formatSingleCustomerPhoneForStorage(customerPhone2) || undefined,
      });
      try {
        await onSave(order.id, fields);
        onClose();
      } catch {
        Alert.alert(t('error'), t('mirrorOrdersEditFailed'));
      }
    })();
  };

  const invoiceLabel = order ? formatMirrorOrderInvoiceLabel(order.invoiceNumber) : null;
  const sheetTitle = invoiceLabel
    ? `${t('mirrorOrdersEditTitle')} ${invoiceLabel}`
    : t('mirrorOrdersEditTitle');

  return (
    <BottomSheet
      visible={visible && order !== null}
      title={sheetTitle}
      onClose={onClose}
      showsScrollIndicator
      formFields={[
        'customerName',
        'customerPhone',
        'customerPhone2',
        'customerLocation',
        'customerNotes',
        'customerPhotosLink',
        'pieceCount',
        'orderTotal',
        'collectedAmount',
      ]}
    >
      {order ? (
        <View>
          <MirrorOrderFormSections
            disabled={saving}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            fulfillmentType={fulfillmentType}
            onFulfillmentTypeChange={setFulfillmentType}
            showFulfillmentType
            customerPhone={customerPhone}
            onCustomerPhoneChange={setCustomerPhone}
            customerPhone2={customerPhone2}
            onCustomerPhone2Change={setCustomerPhone2}
            showSecondPhone
            customerLocation={customerLocation}
            onCustomerLocationChange={setCustomerLocation}
            customerNotes={customerNotes}
            onCustomerNotesChange={setCustomerNotes}
            customerPhotosLink={customerPhotosLink}
            onCustomerPhotosLinkChange={setCustomerPhotosLink}
            pieceCount={pieceCount}
            onPieceCountChange={setPieceCount}
            collectedAmount={collectedAmount}
            onCollectedAmountChange={setCollectedAmount}
            fullPrice={effectiveTotalInput}
            onFullPriceChange={setTotalInput}
            fullPriceLocked={!hasCartItems && hasInvoiceDetailsTotal}
            remainingLabel={remainingLabel}
            selectedCatalogImages={catalogMirrorImages}
            onChangeSelectedCatalogImages={setCatalogMirrorImages}
            catalogAnnotationData={catalogMirrorImageAnnotationData}
            onChangeCatalogAnnotationData={
              shouldPersistImageAnnotationsForOrderStatus(order.status)
                ? setCatalogMirrorImageAnnotationData
                : undefined
            }
            studioOrderImages={studioOrderImages}
            onChangeStudioUrls={setStudioOrderImages}
            onAddStudioImages={() => {
              void handleAddStudioImages();
            }}
            onReplaceStudioImage={(imageUrl) => {
              void handleReplaceStudioImage(imageUrl);
            }}
            uploadingStudio={uploadingStudio}
            beforeCatalog={
              hasCartItems ? (
                <EditConfirmedOrderCartItemsSection
                  items={items}
                  customAdditions={customAdditions}
                  discountAmount={discountAmount}
                  subtotal={subtotal}
                  disabled={saving}
                  onUpdateItemQuantity={updateItemQuantity}
                  onRemoveItem={removeItem}
                  onUpdateCustomAdditionQuantity={updateCustomAdditionQuantity}
                />
              ) : null
            }
            afterInvoice={
              <AddOrderInvoiceDetailsSection
                rows={invoiceExtraRows}
                onChangeRows={setInvoiceExtraRows}
                invoiceNote={invoiceNote}
                onInvoiceNoteChange={setInvoiceNote}
                disabled={saving}
              />
            }
            primaryActionLabel={t('mirrorOrdersEditSave')}
            onPrimaryAction={handleSave}
            primaryActionDisabled={saving}
            primaryActionLoading={saving}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
};

export default EditConfirmedOrderSheet;
