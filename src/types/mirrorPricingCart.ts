export type MirrorPricingThickness = '4mm' | '6mm';

export type MirrorPricingItemCategory = 'order' | 'extra';

export interface MirrorPricingCartItem {
  id: string;
  lengthCm: number;
  widthCm: number;
  category: MirrorPricingItemCategory;
  optionId: string;
  labelKey: string;
  thickness: MirrorPricingThickness;
  unitPrice: number;
  quantity: number;
  note?: string;
  createdAt: string;
}
