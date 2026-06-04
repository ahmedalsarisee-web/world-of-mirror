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
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

export function buildFinancePushMessage(
  accountName: string,
  type: string,
  amount: number,
  note?: string,
): {title: string; body: string} {
  const typeLabel = TRANSACTION_TYPE_LABELS[type] ?? type;
  const amountLabel = formatCurrency(amount);
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  const body = trimmedNote
    ? `${accountName} · ${typeLabel} · ${amountLabel} · ${trimmedNote}`
    : `${accountName} · ${typeLabel} · ${amountLabel}`;

  return {
    title: 'عملية مالية جديدة',
    body,
  };
}

export function buildAttendancePushMessage(
  employeeName: string,
  type: 'check_in' | 'check_out',
  note?: string,
): {title: string; body: string} {
  const actionLabel = type === 'check_in' ? 'حضور' : 'انصراف';
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  const body = trimmedNote
    ? `${employeeName} · ${actionLabel} · ${trimmedNote}`
    : `${employeeName} · ${actionLabel}`;

  return {
    title: type === 'check_in' ? 'تسجيل حضور' : 'تسجيل انصراف',
    body,
  };
}

export function buildConfirmedOrderPushMessage(
  customerName: string,
  total: number,
): {title: string; body: string} {
  return {
    title: 'طلب مؤكد جديد',
    body: `${customerName} · ${formatCurrency(total)}`,
  };
}
