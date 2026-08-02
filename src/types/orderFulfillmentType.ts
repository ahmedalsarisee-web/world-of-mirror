import type {TFunction} from 'i18next';

export type OrderFulfillmentType =
  | 'showroom_pickup'
  | 'delivery'
  | 'delivery_installation'
  | 'measurements';

export const ORDER_FULFILLMENT_TYPES: OrderFulfillmentType[] = [
  'showroom_pickup',
  'delivery',
  'delivery_installation',
  'measurements',
];

export function isOrderFulfillmentType(value: unknown): value is OrderFulfillmentType {
  return typeof value === 'string' && ORDER_FULFILLMENT_TYPES.includes(value as OrderFulfillmentType);
}

export function resolveOrderFulfillmentType(value: unknown): OrderFulfillmentType | undefined {
  return isOrderFulfillmentType(value) ? value : undefined;
}

export function getOrderFulfillmentTypeLabel(type: OrderFulfillmentType, t: TFunction): string {
  switch (type) {
    case 'showroom_pickup':
      return t('orderFulfillmentShowroomPickup');
    case 'delivery':
      return t('orderFulfillmentDelivery');
    case 'delivery_installation':
      return t('orderFulfillmentDeliveryInstallation');
    case 'measurements':
      return t('orderFulfillmentMeasurements');
    default:
      return '';
  }
}

export type OrderFulfillmentTypePalette = {
  accent: string;
  background: string;
  border: string;
  selectedBackground: string;
  selectedBorder: string;
  selectedText: string;
  text: string;
};

export function getOrderFulfillmentTypePalette(
  type: OrderFulfillmentType,
  isLight: boolean,
): OrderFulfillmentTypePalette {
  if (type === 'showroom_pickup') {
    return isLight
      ? {
          accent: '#D97706',
          background: '#FFFBEB',
          border: '#FDE68A',
          selectedBackground: '#FEF3C7',
          selectedBorder: '#D97706',
          selectedText: '#92400E',
          text: '#B45309',
        }
      : {
          accent: '#FBBF24',
          background: '#1F1A0A',
          border: '#5C4A14',
          selectedBackground: '#2A2208',
          selectedBorder: '#FBBF24',
          selectedText: '#FDE68A',
          text: '#FCD34D',
        };
  }

  if (type === 'delivery') {
    return isLight
      ? {
          accent: '#16A34A',
          background: '#F0FDF4',
          border: '#BBF7D0',
          selectedBackground: '#DCFCE7',
          selectedBorder: '#16A34A',
          selectedText: '#166534',
          text: '#15803D',
        }
      : {
          accent: '#34D399',
          background: '#0F2219',
          border: '#1F4D35',
          selectedBackground: '#163B2A',
          selectedBorder: '#34D399',
          selectedText: '#BBF7D0',
          text: '#6EE7B7',
        };
  }

  if (type === 'delivery_installation') {
    return isLight
      ? {
          accent: '#2563EB',
          background: '#EFF6FF',
          border: '#BFDBFE',
          selectedBackground: '#DBEAFE',
          selectedBorder: '#2563EB',
          selectedText: '#1D4ED8',
          text: '#1E40AF',
        }
      : {
          accent: '#60A5FA',
          background: '#0F1A2E',
          border: '#1E3A5F',
          selectedBackground: '#172554',
          selectedBorder: '#60A5FA',
          selectedText: '#BFDBFE',
          text: '#93C5FD',
        };
  }

  return isLight
    ? {
        accent: '#7C3AED',
        background: '#F5F3FF',
        border: '#DDD6FE',
        selectedBackground: '#EDE9FE',
        selectedBorder: '#7C3AED',
        selectedText: '#5B21B6',
        text: '#6D28D9',
      }
    : {
        accent: '#A78BFA',
        background: '#1A1033',
        border: '#4C1D95',
        selectedBackground: '#2E1065',
        selectedBorder: '#A78BFA',
        selectedText: '#DDD6FE',
        text: '#C4B5FD',
      };
}
