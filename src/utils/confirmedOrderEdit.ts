import type {MirrorPricingCartItem, MirrorPricingCustomAddition} from '@app/types/mirrorPricingCart';
import {
  shouldPersistImageAnnotationsForOrderStatus,
  type MirrorPricingConfirmedOrder,
} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  getMirrorPricingCartDiscount,
  getMirrorPricingCartEffectiveTotal,
  getMirrorPricingCartSubtotal,
  normalizeCartTotalOverride,
} from '@app/types/mirrorPricingCart';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {
  pruneOrderImageAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {roundMoney} from '@app/utils/format';
import {
  normalizeInvoiceExportExtraLines,
  sumInvoiceExportExtraLines,
  type InvoiceExportExtraLineDraft,
} from '@app/types/invoiceExportExtraLine';
import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';

export type ConfirmedOrderEditFields = Pick<
  MirrorPricingConfirmedOrder,
  | 'customerName'
  | 'fulfillmentType'
  | 'customerPhone'
  | 'customerPhone2'
  | 'customerLocation'
  | 'customerNotes'
  | 'customerPhotosLink'
  | 'catalogMirrorImages'
  | 'catalogMirrorImageAnnotationData'
  | 'studioOrderImages'
  | 'pieceCount'
  | 'collectedAmount'
  | 'subtotal'
  | 'discountAmount'
  | 'total'
  | 'remainingAmount'
  | 'items'
  | 'customAdditions'
  | 'status'
  | 'invoiceExtraLines'
  | 'invoiceNote'
>;

export function buildConfirmedOrderEditFields(params: {
  customerName: string;
  fulfillmentType: OrderFulfillmentType;
  customerPhone: string;
  customerPhone2?: string;
  customerLocation: string;
  customerNotes: string;
  customerPhotosLink: string;
  catalogMirrorImages: MirrorCatalogImageId[];
  catalogMirrorImageAnnotationData?: CatalogMirrorImageAnnotationData;
  studioOrderImages?: string[];
  pieceCount: number;
  collectedAmount: number;
  status?: MirrorPricingOrderStatus;
  totalInput: number;
  items: MirrorPricingCartItem[];
  customAdditions?: MirrorPricingCustomAddition[];
  invoiceExtraRows?: InvoiceExportExtraLineDraft[];
  invoiceNote?: string;
}): ConfirmedOrderEditFields {
  const customAdditions = params.customAdditions ?? [];
  const cartSubtotal = getMirrorPricingCartSubtotal(params.items, customAdditions);
  const cartTotalOverride = normalizeCartTotalOverride(params.totalInput, cartSubtotal);
  const savedInvoiceExtraLines = normalizeInvoiceExportExtraLines(params.invoiceExtraRows ?? []);
  const savedInvoiceNote = params.invoiceNote?.trim() || undefined;

  let subtotal: number;
  let total: number;
  let discountAmount: number;

  if (cartSubtotal > 0) {
    subtotal = cartSubtotal;
    total = getMirrorPricingCartEffectiveTotal(params.items, cartTotalOverride, customAdditions);
    discountAmount = getMirrorPricingCartDiscount(params.items, cartTotalOverride, customAdditions);
  } else if (savedInvoiceExtraLines.length > 0) {
    subtotal = sumInvoiceExportExtraLines(savedInvoiceExtraLines);
    total = subtotal;
    discountAmount = 0;
  } else {
    subtotal = 0;
    total = roundMoney(Math.max(0, params.totalInput));
    discountAmount = 0;
  }

  const collectedAmount = roundMoney(Math.max(0, params.collectedAmount));
  const remainingAmount = roundMoney(Math.max(0, total - collectedAmount));

  return {
    customerName: params.customerName,
    fulfillmentType: params.fulfillmentType,
    customerPhone: params.customerPhone,
    customerPhone2: params.customerPhone2?.trim() || undefined,
    customerLocation: params.customerLocation,
    customerNotes: params.customerNotes.trim() || undefined,
    customerPhotosLink: params.customerPhotosLink.trim() || undefined,
    catalogMirrorImages:
      params.catalogMirrorImages.length > 0 ? [...params.catalogMirrorImages] : undefined,
    catalogMirrorImageAnnotationData: shouldPersistImageAnnotationsForOrderStatus(params.status)
      ? pruneOrderImageAnnotationData(
          params.catalogMirrorImages,
          params.studioOrderImages,
          params.catalogMirrorImageAnnotationData,
        )
      : undefined,
    studioOrderImages:
      (params.studioOrderImages ?? []).length > 0 ? [...(params.studioOrderImages ?? [])] : undefined,
    pieceCount: params.pieceCount > 0 ? Math.round(params.pieceCount) : undefined,
    collectedAmount,
    subtotal,
    discountAmount,
    total,
    remainingAmount,
    items: params.items,
    customAdditions: customAdditions.length > 0 ? customAdditions : undefined,
    status: resolveMirrorPricingOrderStatus(params.status),
    invoiceExtraLines: savedInvoiceExtraLines.length > 0 ? savedInvoiceExtraLines : undefined,
    invoiceNote: savedInvoiceNote,
  };
}

export type ConfirmedOrderEditDraftParams = Parameters<typeof buildConfirmedOrderEditFields>[0];

export function buildConfirmedOrderPreview(
  order: MirrorPricingConfirmedOrder,
  params: ConfirmedOrderEditDraftParams,
): MirrorPricingConfirmedOrder {
  return {
    ...order,
    ...buildConfirmedOrderEditFields({
      ...params,
      status: params.status ?? order.status,
    }),
  };
}
