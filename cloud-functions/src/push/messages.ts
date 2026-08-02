const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  received: 'استلام',
  paid: 'دفع',
  order_collection: 'تحصيل طلب',
  advance: 'سلفة',
  advance_repayment: 'سداد سلفة',
  ledger_debit: 'دفع',
  ledger_credit: 'استلام',
};

export function formatCurrency(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${value.toLocaleString('ar-SA')} د.أ`;
}

export function buildFinancePushMessage(
  actorName: string,
  accountName: string,
  type: string,
  amount: number,
  note?: string,
): {title: string; body: string} {
  const typeLabel = TRANSACTION_TYPE_LABELS[type] ?? type;
  const amountLabel = formatCurrency(amount);
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  const body = trimmedNote
    ? `قام ${actorName} بتسجيل ${typeLabel} على حساب ${accountName} بمبلغ ${amountLabel} — ${trimmedNote}`
    : `قام ${actorName} بتسجيل ${typeLabel} على حساب ${accountName} بمبلغ ${amountLabel}`;

  return {
    title: 'حركة مالية جديدة',
    body,
  };
}

export function buildAttendancePushMessage(
  employeeName: string,
  type: 'check_in' | 'check_out',
  note?: string,
): {title: string; body: string} {
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  const isCheckIn = type === 'check_in';
  const body = trimmedNote
    ? isCheckIn
      ? `سجّل ${employeeName} حضوراً — ${trimmedNote}`
      : `سجّل ${employeeName} انصرافاً — ${trimmedNote}`
    : isCheckIn
      ? `سجّل ${employeeName} حضوراً`
      : `سجّل ${employeeName} انصرافاً`;

  return {
    title: isCheckIn ? 'تسجيل حضور' : 'تسجيل انصراف',
    body,
  };
}

export function buildConfirmedOrderPushMessage(
  customerName: string,
  total: number,
  invoiceNumber?: number,
): {title: string; body: string} {
  const invoiceLabel =
    invoiceNumber !== undefined && Number.isFinite(invoiceNumber) && invoiceNumber > 0
      ? `#${Math.floor(invoiceNumber)}`
      : 'طلب جديد';

  return {
    title: 'طلب جديد قيد التجهيز',
    body: `${invoiceLabel} — العميل: ${customerName} — الإجمالي: ${formatCurrency(total)}`,
  };
}

export function buildOrderMovePushMessage(
  employeeName: string,
  fromLabel: string,
  toLabel: string,
  invoiceNumber?: number,
): {title: string; body: string} {
  const invoiceLabel =
    invoiceNumber !== undefined && Number.isFinite(invoiceNumber) && invoiceNumber > 0
      ? `#${Math.floor(invoiceNumber)}`
      : 'طلب';

  return {
    title: 'نقل طلب',
    body: `${invoiceLabel} — نقل ${employeeName} من ${fromLabel} إلى ${toLabel}`,
  };
}

export function buildOrderUpdatedPushMessage(
  actorName: string,
  customerName: string,
  total: number,
  invoiceNumber?: number,
): {title: string; body: string} {
  const invoiceLabel =
    invoiceNumber !== undefined && Number.isFinite(invoiceNumber) && invoiceNumber > 0
      ? `#${Math.floor(invoiceNumber)}`
      : 'طلب';

  return {
    title: 'تعديل طلب',
    body: `قام ${actorName} بتعديل ${invoiceLabel} — العميل: ${customerName} — الإجمالي: ${formatCurrency(total)}`,
  };
}
