import {roundMoney} from '@app/utils/format';

export interface MirrorDimensions {
  lengthCm: number;
  widthCm: number;
}

export interface MirrorPricingComponents {
  area: number;
  perimeter: number;
  mirror4mm: number;
  mirror6mm: number;
  normalLighting: number;
  groove: number;
  design: number;
  touchButton: number;
}

export interface MirrorOrderOption {
  id: string;
  labelKey: string;
  price4mm: number;
  price6mm: number;
}

export interface MirrorExtraPrice {
  id: string;
  labelKey: string;
  price4mm?: number;
  price6mm?: number;
}

function price6mmFrom4mm(price4mm: number, area: number): number {
  return price4mm + 4 * area * 1.8;
}

export function computeMirrorComponents(lengthCm: number, widthCm: number): MirrorPricingComponents {
  const area = (lengthCm * widthCm) / 10000;
  const perimeter = (2 * lengthCm + 2 * widthCm) / 100;
  const mirror4mm = area * 12 * 1.8;
  const mirror6mm = area * 16 * 1.8;
  const normalLighting = perimeter * 2.2;
  const groove = perimeter * 1.6;
  const design = area * 10;
  const touchButton = normalLighting * 1.5 + 2;

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

export function computeMirrorOrderOptions(components: MirrorPricingComponents): MirrorOrderOption[] {
  const {area, mirror4mm, normalLighting, groove, design, touchButton} = components;
  const upgrade = (price4mm: number) => price6mmFrom4mm(price4mm, area);

  const plain = mirror4mm;
  const plainNormalLight = mirror4mm + normalLighting;
  const plainGroove = mirror4mm + groove;
  const plainGrooveNormalLight = mirror4mm + groove + normalLighting;
  const designNormalLight = design + mirror4mm + normalLighting;
  const designGrooveNormalLight = mirror4mm + normalLighting + groove + design;
  const plainTouch = mirror4mm + touchButton + 2;
  const plainGrooveTouch = mirror4mm + groove + touchButton + 2;
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

export function computeMirrorExtraPrices(components: MirrorPricingComponents): MirrorExtraPrice[] {
  const {area, perimeter} = components;
  const naturalSilver4mm = area * 45 * 1.5;
  const naturalSilver6mm = area * 49 * 1.5;
  const coloredBaklava = area * 55 * 1.5;

  return [
    {id: 'iron_frame', labelKey: 'mirrorExtraIronFrame', price4mm: perimeter * 5.5},
    {id: 'wood_frame', labelKey: 'mirrorExtraWoodFrame', price4mm: perimeter * 5.5},
    {id: 'glass_transparent', labelKey: 'mirrorExtraGlassTransparent', price6mm: area * 11 * 1.8},
    {id: 'glass_black', labelKey: 'mirrorExtraGlassBlack', price6mm: area * 13 * 1.8},
    {id: 'glass_bronze', labelKey: 'mirrorExtraGlassBronze', price6mm: area * 13 * 1.8},
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

export function computeMirrorPricing(dimensions: MirrorDimensions) {
  const components = computeMirrorComponents(dimensions.lengthCm, dimensions.widthCm);
  return {
    components,
    orderOptions: computeMirrorOrderOptions(components),
    extras: computeMirrorExtraPrices(components),
  };
}

export function resolveMirrorOptionPrice(
  option: MirrorOrderOption | MirrorExtraPrice,
  thickness: '4mm' | '6mm',
): number | undefined {
  const raw = thickness === '4mm' ? option.price4mm : option.price6mm;
  return raw === undefined ? undefined : roundMoney(raw);
}

export function getAvailableThicknesses(
  option: MirrorOrderOption | MirrorExtraPrice,
): Array<'4mm' | '6mm'> {
  const available: Array<'4mm' | '6mm'> = [];
  if (option.price4mm !== undefined) {
    available.push('4mm');
  }
  if (option.price6mm !== undefined) {
    available.push('6mm');
  }
  return available;
}
