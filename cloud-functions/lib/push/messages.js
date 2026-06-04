"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.buildFinancePushMessage = buildFinancePushMessage;
exports.buildAttendancePushMessage = buildAttendancePushMessage;
exports.buildConfirmedOrderPushMessage = buildConfirmedOrderPushMessage;
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
    return `${value.toLocaleString('ar-SA')} ر.س`;
}
function buildFinancePushMessage(accountName, type, amount, note) {
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
function buildAttendancePushMessage(employeeName, type, note) {
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
function buildConfirmedOrderPushMessage(customerName, total) {
    return {
        title: 'طلب مؤكد جديد',
        body: `${customerName} · ${formatCurrency(total)}`,
    };
}
//# sourceMappingURL=messages.js.map