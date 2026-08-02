"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TELEGRAM_NEW_ORDERS_CHAT_ID = void 0;
exports.buildTelegramOrderShareMessage = buildTelegramOrderShareMessage;
exports.sendMirrorOrderToTelegram = sendMirrorOrderToTelegram;
/** Public channel for new mirror orders: https://t.me/ahmadsarisee */
exports.TELEGRAM_NEW_ORDERS_CHAT_ID = '@ahmadsarisee';
function roundMoney(amount) {
    if (!Number.isFinite(amount)) {
        return 0;
    }
    return Math.round(amount * 100) / 100;
}
function displayValue(value) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '—';
}
function formatDeliveryShareAmount(amount) {
    const normalized = roundMoney(amount);
    const formatted = Number.isInteger(normalized)
        ? String(normalized)
        : normalized.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${formatted}jd`;
}
function normalizeInvoiceNumber(value) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n < 1) {
        return undefined;
    }
    return Math.floor(n);
}
function formatInvoiceLabel(invoiceNumber) {
    const n = normalizeInvoiceNumber(invoiceNumber);
    if (!n) {
        return null;
    }
    return `#${n}`;
}
function resolveRemaining(data) {
    if (typeof data.remainingAmount === 'number' && !Number.isNaN(data.remainingAmount)) {
        return Math.max(0, data.remainingAmount);
    }
    const total = Number(data.total ?? 0);
    const collected = Number(data.collectedAmount ?? 0);
    return Math.max(0, total - collected);
}
function resolvePieceCount(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const fromItems = items.reduce((sum, entry) => {
        const quantity = Number(entry.quantity ?? 0);
        return sum + (Number.isFinite(quantity) ? quantity : 0);
    }, 0);
    if (fromItems > 0) {
        return fromItems;
    }
    const manual = Number(data.pieceCount ?? 0);
    if (Number.isFinite(manual) && manual > 0) {
        return Math.round(manual);
    }
    return 0;
}
/** Same wording as the in-app delivery company share (Arabic labels). */
function buildTelegramOrderShareMessage(data) {
    const invoiceLabel = formatInvoiceLabel(data.invoiceNumber);
    const total = Number(data.total ?? 0);
    const collected = Number(data.collectedAmount ?? 0);
    const remaining = resolveRemaining(data);
    const priceLine = `السعر : ${formatDeliveryShareAmount(total)} واصل ${formatDeliveryShareAmount(collected)} متبقي ${formatDeliveryShareAmount(remaining)}`;
    return [
        `رقم الطلب : ${invoiceLabel ?? '—'}`,
        `اسم العميل : ${displayValue(String(data.customerName ?? ''))}`,
        `رقم الموبايل : ${displayValue(String(data.customerPhone ?? ''))}`,
        `الموقع : ${displayValue(String(data.customerLocation ?? ''))}`,
        `عدد القطع : ${resolvePieceCount(data)}`,
        `ملاحظات : ${displayValue(String(data.customerNotes ?? ''))}`,
        priceLine,
    ].join('\n');
}
async function sendMirrorOrderToTelegram(botToken, data) {
    const token = botToken?.trim();
    if (!token) {
        console.warn('[sendMirrorOrderToTelegram] TELEGRAM_BOT_TOKEN is not configured');
        return;
    }
    const message = buildTelegramOrderShareMessage(data);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: exports.TELEGRAM_NEW_ORDERS_CHAT_ID,
            text: message,
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
    }
}
//# sourceMappingURL=telegramOrderShare.js.map