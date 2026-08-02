import type {MirrorPricingCartItem, MirrorPricingCustomAddition} from '@app/types/mirrorPricingCart';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
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
  pruneCatalogAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/mirrorCatalogImageAnnotations';
import {roundMoney} from '@app/utils/format';

export type ConfirmedOrderEditFields = Pick<
  MirrorPricingConfirmedOrder,
  | 'customerName'
  | 'customerPhone'
  | 'customerLocation'
  | 'customerNotes'
  | 'customerPhotosLink'
  | 'catalogMirrorImages'
  | 'catalogMirrorImageAnnotationData'
  | 'pieceCount'
  | 'collectedAmount'
  | 'subtotal'
  | 'discountAmount'
  | 'total'
  | 'remainingAmount'
  | 'items'
  | 'customAdditions'
  | 'status'
>;

export function buildConfirmedOrderEditFields(params: {
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerNotes: string;
  customerPhotosLink: string;
  catalogMirrorImages: MirrorCatalogImageId[];
  catalogMirrorImageAnnotationData?: CatalogMirrorImageAnnotationData;
  pieceCount: number;
  collectedAmount: number;
  status?: MirrorPricingOrderStatus;
  totalInput: number;
  items: MirrorPricingCartItem[];
  customAdditions?: MirrorPricingCustomAddition[];
}): ConfirmedOrderEditFields {
  const customAdditions = params.customAdditions ?? [];
  const subtotal = getMirrorPricingCartSubtotal(params.items, customAdditions);
  const cartTotalOverride = normalizeCartTotalOverride(params.totalInput, subtotal);
  const total =
    subtotal > 0
      ? getMirrorPricingCartEffectiveTotal(params.items, cartTotalOverride, customAdditions)
      : roundMoney(Math.max(0, params.totalInput));
  const discountAmount = getMirrorPricingCartDiscount(params.items, cartTotalOverride, customAdditions);
  const collectedAmount = roundMoney(Math.max(0, params.collectedAmount));
  const remainingAmount = roundMoney(Math.max(0, total - collectedAmount));

  return {
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    customerLocation: params.customerLocation,
    customerNotes: params.customerNotes.trim() || undefined,
    customerPhotosLink: params.customerPhotosLink.trim() || undefined,
    catalogMirrorImages:
      params.catalogMirrorImages.length > 0 ? [...params.catalogMirrorImages] : undefined,
    catalogMirrorImageAnnotationData: pruneCatalogAnnotationData(
      params.catalogMirrorImages,
      params.catalogMirrorImageAnnotationData,
    ),
    pieceCount: params.pieceCount > 0 ? Math.round(params.pieceCount) : undefined,
    collectedAmount,
    subtotal,
    discountAmount,
    total,
    remainingAmount,
    items: params.items,
    customAdditions: customAdditions.length > 0 ? customAdditions : undefined,
    status: resolveMirrorPricingOrderStatus(params.status),
  };
}
