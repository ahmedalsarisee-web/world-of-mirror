import type {MirrorDimensions} from '@app/utils/mirrorPricing';
import {
  getAvailableThicknesses,
  resolveMirrorOptionPrice,
  type MirrorExtraPrice,
  type MirrorOrderOption,
  type MirrorPricingComponents,
} from '@app/utils/mirrorPricing';
import type {MirrorPricingCartItem} from '@app/types/mirrorPricingCart';

function price6mmFrom4mm(price4mm: number, area: number): number {
  return price4mm + 3 * area;
}

export function computeMirrorCostComponents(lengthCm: number, widthCm: number): MirrorPricingComponents {
  const area = (lengthCm * widthCm) / 10000;
  const perimeter = (2 * lengthCm + 2 * widthCm) / 100;
  const mirror4mm = area * 12;
  const mirror6mm = area * 15;
  const normalLighting = perimeter * 0.45 + 0.5;
  const groove = perimeter * 0.8;
  const design = area * 4.5;
  const touchButton = perimeter * 0.5 + 2;

  return {
    area,
    perimeter,
    mirror4mm,
    mirror6mm,
    normalLighting,
    groove,
    design,
    touchButton,
  };
}

export function computeMirrorCostOrderOptions(components: MirrorPricingComponents): MirrorOrderOption[] {
  const {area, mirror4mm, normalLighting, groove, design, touchButton} = components;
  const upgrade = (price4mm: number) => price6mmFrom4mm(price4mm, area);

  const plain = mirror4mm;
  const plainNormalLight = mirror4mm + normalLighting;
  const plainGroove = mirror4mm + groove;
  const plainGrooveNormalLight = mirror4mm + groove + normalLighting;
  const designNormalLight = design + mirror4mm + normalLighting;
  const designGrooveNormalLight = mirror4mm + normalLighting + groove + design;
  const plainTouch = mirror4mm + touchButton + 1;
  const plainGrooveTouch = mirror4mm + groove + touchButton + 1;
  const designTouch = mirror4mm + design + touchButton;
  const designGrooveTouch = mirror4mm + groove + touchButton + design;

  return [
    {id: 'plain_no_light', labelKey: 'mirrorOptionPlainNoLight', price4mm: plain, price6mm: upgrade(plain)},
    {
      id: 'plain_normal_light',
      labelKey: 'mirrorOptionPlainNormalLight',
      price4mm: plainNormalLight,
      price6mm: upgrade(plainNormalLight),
    },
    {
      id: 'plain_groove_no_light',
      labelKey: 'mirrorOptionPlainGrooveNoLight',
      price4mm: plainGroove,
      price6mm: upgrade(plainGroove),
    },
    {
      id: 'plain_groove_normal_light',
      labelKey: 'mirrorOptionPlainGrooveNormalLight',
      price4mm: plainGrooveNormalLight,
      price6mm: upgrade(plainGrooveNormalLight),
    },
    {
      id: 'design_normal_light',
      labelKey: 'mirrorOptionDesignNormalLight',
      price4mm: designNormalLight,
      price6mm: upgrade(designNormalLight),
    },
    {
      id: 'design_groove_normal_light',
      labelKey: 'mirrorOptionDesignGrooveNormalLight',
      price4mm: designGrooveNormalLight,
      price6mm: upgrade(designGrooveNormalLight),
    },
    {id: 'plain_touch', labelKey: 'mirrorOptionPlainTouch', price4mm: plainTouch, price6mm: upgrade(plainTouch)},
    {
      id: 'plain_groove_touch',
      labelKey: 'mirrorOptionPlainGrooveTouch',
      price4mm: plainGrooveTouch,
      price6mm: upgrade(plainGrooveTouch),
    },
    {
      id: 'design_touch',
      labelKey: 'mirrorOptionDesignTouch',
      price4mm: designTouch,
      price6mm: upgrade(designTouch),
    },
    {
      id: 'design_groove_touch',
      labelKey: 'mirrorOptionDesignGrooveTouch',
      price4mm: designGrooveTouch,
      price6mm: upgrade(designGrooveTouch),
    },
  ];
}

export function computeMirrorCostExtraPrices(components: MirrorPricingComponents): MirrorExtraPrice[] {
  const {area, perimeter} = components;
  const naturalSilver4mm = area * 45;
  const naturalSilver6mm = area * 49;
  const coloredBaklava = area * 55;

  return [
    {id: 'iron_frame', labelKey: 'mirrorExtraIronFrame', price4mm: perimeter * 5.5},
    {id: 'wood_frame', labelKey: 'mirrorExtraWoodFrame', price4mm: perimeter * 5.5},
    {id: 'glass_transparent', labelKey: 'mirrorExtraGlassTransparent', price6mm: area * 11},
    {id: 'glass_black', labelKey: 'mirrorExtraGlassBlack', price6mm: area * 13},
    {id: 'glass_bronze', labelKey: 'mirrorExtraGlassBronze', price6mm: area * 13},
    {
      id: 'baklava_natural',
      labelKey: 'mirrorExtraBaklavaNatural',
      price4mm: naturalSilver4mm,
      price6mm: naturalSilver6mm,
    },
    {
      id: 'baklava_colored',
      labelKey: 'mirrorExtraBaklavaColored',
      price4mm: coloredBaklava,
      price6mm: coloredBaklava,
    },
  ];
}

export function computeMirrorCostPricing(dimensions: MirrorDimensions) {
  const components = computeMirrorCostComponents(dimensions.lengthCm, dimensions.widthCm);
  return {
    components,
    orderOptions: computeMirrorCostOrderOptions(components),
    extras: computeMirrorCostExtraPrices(components),
  };
}

export function getMirrorCartItemUnitCost(item: MirrorPricingCartItem): number | undefined {
  if (item.lengthCm <= 0 || item.widthCm <= 0) {
    return undefined;
  }

  const pricing = computeMirrorCostPricing({lengthCm: item.lengthCm, widthCm: item.widthCm});
  const options = item.category === 'order' ? pricing.orderOptions : pricing.extras;
  const option = options.find((entry) => entry.id === item.optionId);
  if (!option) {
    return undefined;
  }

  const available = getAvailableThicknesses(option);
  if (!available.includes(item.thickness)) {
    return undefined;
  }

  return resolveMirrorOptionPrice(option, item.thickness);
}

export function getMirrorCartItemLineCost(item: MirrorPricingCartItem): number {
  const unitCost = getMirrorCartItemUnitCost(item);
  if (unitCost === undefined) {
    return 0;
  }
  return unitCost * item.quantity;
}

export function getMirrorPricingCartCostTotal(items: MirrorPricingCartItem[]): number {
  return items.reduce((sum, item) => sum + getMirrorCartItemLineCost(item), 0);
}
