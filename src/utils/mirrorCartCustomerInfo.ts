import {getCustomerPhoneErrorKey, getOptionalSingleCustomerPhoneErrorKey} from '@app/utils/customerPhone';
import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';

export interface MirrorCartCustomerInfoInput {
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  customerLocation: string;
}

export type MirrorCartCustomerFieldKey =
  | 'fulfillmentType'
  | 'customerName'
  | 'customerPhone'
  | 'customerPhone2'
  | 'customerLocation';

export type MirrorCartCustomerFieldErrors = Partial<
  Record<MirrorCartCustomerFieldKey, string>
>;

export function resolveMirrorCartCustomerFieldErrors(
  info: MirrorCartCustomerInfoInput,
  fulfillmentType?: OrderFulfillmentType | null,
): MirrorCartCustomerFieldErrors {
  const errors: MirrorCartCustomerFieldErrors = {};

  if (!fulfillmentType) {
    errors.fulfillmentType = 'orderFulfillmentTypeRequired';
  }

  if (!info.customerName.trim()) {
    errors.customerName = 'mirrorCartConfirmCustomerNameRequired';
  }

  if (!info.customerPhone.trim()) {
    errors.customerPhone = 'mirrorCartConfirmCustomerPhoneRequired';
  } else {
    const phoneError = getCustomerPhoneErrorKey(info.customerPhone);
    if (phoneError) {
      errors.customerPhone = phoneError;
    }
  }

  const phone2Error = getOptionalSingleCustomerPhoneErrorKey(info.customerPhone2 ?? '');
  if (phone2Error) {
    errors.customerPhone2 = phone2Error;
  }

  if (!info.customerLocation.trim()) {
    errors.customerLocation = 'mirrorCartConfirmCustomerLocationRequired';
  }

  return errors;
}

export function getFirstMirrorCartCustomerFieldError(
  errors: MirrorCartCustomerFieldErrors,
): string | null {
  return (
    errors.fulfillmentType ??
    errors.customerName ??
    errors.customerPhone ??
    errors.customerPhone2 ??
    errors.customerLocation ??
    null
  );
}

export function isMirrorCartCustomerInfoComplete(info: MirrorCartCustomerInfoInput): boolean {
  return getMirrorCartCustomerInfoConfirmErrorKey(info) === null;
}

export function getMirrorCartCustomerInfoConfirmErrorKey(
  info: MirrorCartCustomerInfoInput,
): string | null {
  return getFirstMirrorCartCustomerFieldError(resolveMirrorCartCustomerFieldErrors(info));
}
