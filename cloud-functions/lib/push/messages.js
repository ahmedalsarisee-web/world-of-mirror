"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.buildFinancePushMessage = buildFinancePushMessage;
exports.buildAttendancePushMessage = buildAttendancePushMessage;
exports.buildConfirmedOrderPushMessage = buildConfirmedOrderPushMessage;
exports.buildOrderMovePushMessage = buildOrderMovePushMessage;
const TRANSACTION_TYPE_LABELS = {
    received: 'استلام',
    paid: 'دفع',
    order_collection: 'تحصيل طلب',
    advance: 'سلفة',
    advance_repayment: 'سداد سلفة',
    ledger_debit: 'دفع',
    ledger_credit: 'استلام',
};
function formatCurrency(amount) {
    const value = Number.isFinite(amount) ? amount : 0;
    return `${value.toLocaleString('ar-SA')} د.أ`;
}
function buildFinancePushMessage(actorName, accountName, type, amount, note) {
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
function buildAttendancePushMessage(employeeName, type, note) {
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
function buildConfirmedOrderPushMessage(customerName, total, invoiceNumber) {
    const invoiceLabel = invoiceNumber !== undefined && Number.isFinite(invoiceNumber) && invoiceNumber > 0
        ? `#${Math.floor(invoiceNumber)}`
        : 'طلب جديد';
    return {
        title: 'طلب جديد قيد التجهيز',
        body: `${invoiceLabel} — العميل: ${customerName} — الإجمالي: ${formatCurrency(total)}`,
    };
}
function buildOrderMovePushMessage(employeeName, fromLabel, toLabel, invoiceNumber) {
    const invoiceLabel = invoiceNumber !== undefined && Number.isFinite(invoiceNumber) && invoiceNumber > 0
        ? `#${Math.floor(invoiceNumber)}`
        : 'طلب';
    return {
        title: 'نقل طلب',
        body: `${invoiceLabel} — نقل ${employeeName} من ${fromLabel} إلى ${toLabel}`,
    };
}
//# sourceMappingURL=messages.js.map