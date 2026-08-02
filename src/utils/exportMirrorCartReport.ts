import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveConfirmedOrderDiscount,
  resolveConfirmedOrderSubtotal,
} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingCartItem, MirrorPricingCustomAddition} from '@app/types/mirrorPricingCart';
import {
  getCustomAdditionLineTotal,
  getCustomAdditionQuantity,
  normalizeMirrorPricingCartItem,
  normalizeMirrorPricingCustomAddition,
} from '@app/types/mirrorPricingCart';
import {formatCurrency, formatDateTime, roundMoney} from '@app/utils/format';
import {formatOrderConfirmedByLabel} from '@app/utils/confirmedOrderConfirmedBy';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {getMirrorPricingCartCount, getMirrorPricingCartSubtotal} from '@app/types/mirrorPricingCart';
import type {InvoiceExportExtraLine} from '@app/types/invoiceExportExtraLine';
import {resolveInvoiceExtraLineTotal} from '@app/types/invoiceExportExtraLine';
import {
  buildExportReportCircularLogoHtml,
  getExportReportCircularLogoCss,
  loadExportReportLogoDataUri,
} from '@app/utils/exportReportLogo';

const INVOICE_CONTACT_PHONES = ['0798454101', '0799036387'] as const;

const BRAND = {
  primary: '#6C4DFF',
  primaryDark: '#5738F5',
  success: '#16A34A',
  text: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  surface: '#F8FAFC',
};

export interface MirrorCartExportData {
  invoiceNumber?: number;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerNotes?: string;
  customerPhotosLink?: string;
  confirmedByUserName?: string;
  confirmedByUserRole?: 'admin' | 'employee';
  collectedAmount: number;
  items: MirrorPricingCartItem[];
  customAdditions?: MirrorPricingCustomAddition[];
  subtotal?: number;
  discountAmount?: number;
  total?: number;
  extraInvoiceLines?: InvoiceExportExtraLine[];
  invoiceNote?: string;
}

interface ExportOptions {
  isRtl?: boolean;
  appName?: string;
  documentTitle?: string;
  generatedAt?: string;
  shareDialogTitle?: string;
  extraInvoiceLines?: InvoiceExportExtraLine[];
  invoiceNote?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function amountCell(amount: number, currencyLabel: string): string {
  return `<span class="amount">${escapeHtml(formatCurrency(amount, currencyLabel))}</span>`;
}

async function loadLogoDataUri(): Promise<string> {
  return loadExportReportLogoDataUri();
}

function getWritableDirectory(): string {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No writable app directory');
  }
  return directory;
}

async function prepareShareablePdf(result: Print.FilePrintResult, fileStem: string): Promise<string> {
  const fileName = `${fileStem}-${dayjs().format('YYYY-MM-DD-HHmm')}.pdf`;
  const shareUri = `${getWritableDirectory()}${fileName}`;

  const existing = await FileSystem.getInfoAsync(shareUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(shareUri, {idempotent: true});
  }

  if (result.base64) {
    await FileSystem.writeAsStringAsync(shareUri, result.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    await FileSystem.copyAsync({from: result.uri, to: shareUri});
  }

  const written = await FileSystem.getInfoAsync(shareUri);
  if (!written.exists) {
    throw new Error('PDF file was not created');
  }

  return written.uri ?? shareUri;
}

async function sharePdfFile(shareUri: string, dialogTitle: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
}

function buildMirrorCartReportHtml(
  data: MirrorCartExportData,
  t: TFunction,
  logoDataUri: string,
  options: ExportOptions,
): string {
  const {
    customerName,
    customerPhone,
    customerLocation,
    customerNotes,
    confirmedByUserName,
    confirmedByUserRole,
    collectedAmount,
    items: rawItems,
    customAdditions: rawCustomAdditions = [],
  } = data;
  const items = normalizeExportItems(rawItems);
  const customAdditions = normalizeExportCustomAdditions(rawCustomAdditions);
  const currencyLabel = t('currencyLabel');
  const subtotal = data.subtotal ?? getMirrorPricingCartSubtotal(items, customAdditions);
  const total = data.total ?? subtotal;
  const discountAmount = data.discountAmount ?? Math.max(0, subtotal - total);
  const count = getMirrorPricingCartCount(items);
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const totalsAlign = options.isRtl ? 'left' : 'right';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const documentTitle = escapeHtml(options.documentTitle ?? t('mirrorCartPdfTitle'));
  const exportDateIso = options.generatedAt ?? new Date().toISOString();
  const exportDate = formatDateTime(exportDateIso);
  const isInvoice = (options.documentTitle ?? t('mirrorCartPdfTitle')) === t('mirrorOrderInvoiceTitle');
  const invoiceDateLabel = isInvoice ? t('mirrorCartPdfInvoiceDate') : t('mirrorCartPdfGeneratedAt');
  const sortedItems = [...items].reverse();
  const sortedCustomAdditions = [...customAdditions].reverse();
  const extraInvoiceLines = (data.extraInvoiceLines ?? []).filter(
    (entry) => entry.specification.trim().length > 0 && entry.unitPrice > 0 && entry.quantity > 0,
  );
  const extraInvoiceTotal = roundMoney(
    extraInvoiceLines.reduce((sum, entry) => sum + resolveInvoiceExtraLineTotal(entry), 0),
  );
  const useManualInvoiceItems = extraInvoiceLines.length > 0;
  const displayTotal = useManualInvoiceItems ? extraInvoiceTotal : roundMoney(total);
  const displayRemaining = Math.max(0, displayTotal - collectedAmount);
  const lineCount = useManualInvoiceItems
    ? extraInvoiceLines.length
    : count + sortedCustomAdditions.length;
  const invoiceNote = data.invoiceNote?.trim() ?? '';

  const invoiceLabel = formatMirrorOrderInvoiceLabel(data.invoiceNumber);
  const confirmedByLabel = formatOrderConfirmedByLabel(
    {confirmedByUserName, confirmedByUserRole},
    t,
  );

  const customerFields = [
    {label: t('customerName'), value: customerName},
    {label: t('mirrorCartCustomerPhone'), value: customerPhone},
    {label: t('mirrorCartLocation'), value: customerLocation},
    {label: t('mirrorCartCustomerNotes'), value: customerNotes ?? ''},
  ].filter((field) => field.value.trim());

  const invoiceFields = (
    isInvoice
      ? [
          confirmedByLabel
            ? {label: t('mirrorOrdersConfirmedByLabel'), value: confirmedByLabel}
            : null,
        ]
      : [
          invoiceLabel ? {label: t('mirrorOrderInvoiceNumber'), value: invoiceLabel} : null,
          {label: invoiceDateLabel, value: exportDate},
          confirmedByLabel
            ? {label: t('mirrorOrdersConfirmedByLabel'), value: confirmedByLabel}
            : null,
        ]
  ).filter((field): field is {label: string; value: string} => field !== null && Boolean(field.value.trim()));

  const customerCardHtml = customerFields.length
    ? `
      <div class="meta-card">
        <div class="meta-card-title">${escapeHtml(t('mirrorInvoiceBillTo'))}</div>
        ${customerFields
          .map(
            (field) => `
          <div class="meta-row">
            <span class="meta-label">${escapeHtml(field.label)}</span>
            <span class="meta-value">${escapeHtml(field.value)}</span>
          </div>`,
          )
          .join('')}
      </div>`
    : '';

  const invoiceCardHtml = invoiceFields.length
    ? `
    <div class="meta-card meta-card-accent">
      <div class="meta-card-title">${escapeHtml(t('mirrorInvoiceDetails'))}</div>
      ${invoiceFields
        .map(
          (field) => `
        <div class="meta-row">
          <span class="meta-label">${escapeHtml(field.label)}</span>
          <span class="meta-value">${escapeHtml(field.value)}</span>
        </div>`,
        )
        .join('')}
    </div>`
    : '';

  const itemRows = sortedItems
    .map((item, index) => {
      const lineTotal = item.unitPrice * item.quantity;
      const thickness =
        item.thickness === '4mm' ? t('mirrorCartPdfThickness4mm') : t('mirrorCartPdfThickness6mm');
      const noteHtml = item.note
        ? `<div class="item-note">${escapeHtml(item.note)}</div>`
        : '';

      return `
        <tr>
          <td class="center col-index">${index + 1}</td>
          <td class="col-product">
            <div class="product-name">${escapeHtml(resolveMirrorCartItemLabel(t, item))}</div>
            ${noteHtml}
          </td>
          <td class="center col-size ltr">${item.lengthCm} × ${item.widthCm} ${escapeHtml(t('mirrorUnitCm'))}</td>
          <td class="center col-thickness">${escapeHtml(thickness)}</td>
          <td class="center col-qty">${item.quantity}</td>
          <td class="amount-cell col-unit">${amountCell(item.unitPrice, currencyLabel)}</td>
          <td class="amount-cell col-line">${amountCell(lineTotal, currencyLabel)}</td>
        </tr>
      `;
    })
    .join('');

  const customAdditionRows = sortedCustomAdditions
    .map((entry, index) => {
      const rowIndex = sortedItems.length + index;
      const quantity = getCustomAdditionQuantity(entry);
      const lineTotal = getCustomAdditionLineTotal(entry);

      return `
        <tr>
          <td class="center col-index">${rowIndex + 1}</td>
          <td class="col-product">
            <div class="product-name">${escapeHtml(entry.label)}</div>
            <div class="item-note">${escapeHtml(t('mirrorCartCustomAdditionKind'))}</div>
          </td>
          <td class="center col-size">—</td>
          <td class="center col-thickness">—</td>
          <td class="center col-qty">${quantity}</td>
          <td class="amount-cell col-unit">${amountCell(entry.price, currencyLabel)}</td>
          <td class="amount-cell col-line">${amountCell(lineTotal, currencyLabel)}</td>
        </tr>
      `;
    })
    .join('');

  const extraInvoiceRows = extraInvoiceLines
    .map((entry, index) => {
      const unitPrice = roundMoney(entry.unitPrice);
      const quantity = Math.max(1, Math.round(entry.quantity));
      const lineTotal = resolveInvoiceExtraLineTotal(entry);

      return `
        <tr>
          <td class="center col-index">${index + 1}</td>
          <td class="col-product">
            <div class="product-name">${escapeHtml(entry.specification.trim())}</div>
          </td>
          <td class="center col-size">—</td>
          <td class="center col-thickness">—</td>
          <td class="center col-qty">${quantity}</td>
          <td class="amount-cell col-unit">${amountCell(unitPrice, currencyLabel)}</td>
          <td class="amount-cell col-line">${amountCell(lineTotal, currencyLabel)}</td>
        </tr>
      `;
    })
    .join('');

  const invoiceItemRows = useManualInvoiceItems
    ? extraInvoiceRows
    : `${itemRows}${customAdditionRows}`;

  const summaryRows = [
    !useManualInvoiceItems && discountAmount > 0
      ? `<tr>
          <td class="summary-label">${escapeHtml(t('mirrorCartSubtotal'))}</td>
          <td class="summary-value">${amountCell(subtotal, currencyLabel)}</td>
        </tr>
        <tr>
          <td class="summary-label">${escapeHtml(t('mirrorCartDiscount'))}</td>
          <td class="summary-value summary-discount">− ${escapeHtml(formatCurrency(discountAmount, currencyLabel))}</td>
        </tr>`
      : '',
    `<tr class="summary-grand">
      <td class="summary-label">${escapeHtml(t('mirrorCartFullPrice'))}</td>
      <td class="summary-value summary-total">${amountCell(displayTotal, currencyLabel)}</td>
    </tr>`,
    useManualInvoiceItems || collectedAmount > 0
      ? `<tr>
          <td class="summary-label">${escapeHtml(t('mirrorCartCollectedAmount'))}</td>
          <td class="summary-value">${amountCell(collectedAmount, currencyLabel)}</td>
        </tr>
        <tr>
          <td class="summary-label">${escapeHtml(t('mirrorCartRemainingAmount'))}</td>
          <td class="summary-value summary-remaining">${amountCell(displayRemaining, currencyLabel)}</td>
        </tr>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const invoiceNoteHtml = invoiceNote
    ? `
      <div class="invoice-note-wrap">
        <div class="invoice-note-title">${escapeHtml(t('mirrorInvoiceExtraItemsNoteLabel'))}</div>
        <div class="invoice-note-body">${escapeHtml(invoiceNote)}</div>
      </div>`
    : '';

  const logoHtml = buildExportReportCircularLogoHtml(appName, logoDataUri, BRAND);
  const logoCss = getExportReportCircularLogoCss(BRAND, Boolean(options.isRtl));
  const contactPhonesHtml = INVOICE_CONTACT_PHONES.map((phone) => escapeHtml(phone)).join(
    `<span class="phone-sep"> · </span>`,
  );
  const invoiceBadgeHtml = invoiceLabel
    ? `<div class="invoice-badge">
        <span class="invoice-badge-kicker">${documentTitle}</span>
        <span class="invoice-badge-number ltr">${escapeHtml(invoiceLabel)}</span>
        <span class="invoice-badge-date">${escapeHtml(exportDate)}</span>
      </div>`
    : `<div class="invoice-badge">
        <span class="invoice-badge-kicker">${documentTitle}</span>
        <span class="invoice-badge-date">${escapeHtml(exportDate)}</span>
      </div>`;

  return `<!DOCTYPE html>
<html lang="${options.isRtl ? 'ar' : 'en'}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 16px; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 0;
        font-family: "Segoe UI", Tahoma, Arial, Helvetica, sans-serif;
        color: ${BRAND.text};
        background: #fff;
        direction: ${dir};
        text-align: ${align};
        font-size: 12px;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page { padding: 0; }
      .header-band {
        background: linear-gradient(135deg, rgba(108, 77, 255, 0.08), rgba(87, 56, 245, 0.03));
        border: 1px solid rgba(108, 77, 255, 0.12);
        border-radius: 16px;
        padding: 18px 18px 16px;
        margin-bottom: 18px;
      }
      .top-bar {
        height: 4px;
        background: linear-gradient(90deg, ${BRAND.primaryDark}, ${BRAND.primary}, #8B6CFF);
        border-radius: 999px;
        margin-bottom: 16px;
      }
      .header-table { width: 100%; border-collapse: collapse; }
      .header-table td { vertical-align: middle; }
      .brand-cell { width: 68%; }
      .badge-cell { width: 32%; text-align: ${totalsAlign}; }
      .brand-wrap { display: table; width: 100%; }
      .brand-logo, .brand-info { display: table-cell; vertical-align: middle; }
      ${logoCss}
      .brand-name {
        margin: 0 0 5px;
        font-size: 26px;
        font-weight: 800;
        color: ${BRAND.text};
        letter-spacing: -0.4px;
        line-height: 1.15;
      }
      .brand-tagline {
        margin: 0 0 8px;
        font-size: 11px;
        color: ${BRAND.textSecondary};
        line-height: 1.5;
      }
      .brand-phones {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: ${BRAND.primaryDark};
        direction: ltr;
        unicode-bidi: embed;
      }
      .phone-sep { opacity: 0.55; font-weight: 500; }
      .invoice-badge {
        display: inline-block;
        min-width: 168px;
        padding: 14px 16px;
        border-radius: 14px;
        background: linear-gradient(180deg, #fff 0%, ${BRAND.surface} 100%);
        border: 1px solid rgba(108, 77, 255, 0.22);
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
        text-align: center;
      }
      .invoice-badge-kicker {
        display: block;
        font-size: 10px;
        font-weight: 800;
        color: ${BRAND.primaryDark};
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 6px;
      }
      .invoice-badge-number {
        display: block;
        font-size: 22px;
        font-weight: 800;
        color: ${BRAND.text};
        margin-bottom: 4px;
      }
      .invoice-badge-date {
        display: block;
        font-size: 10px;
        font-weight: 600;
        color: ${BRAND.textSecondary};
      }
      .meta-grid {
        width: 100%;
        border-collapse: separate;
        border-spacing: 12px 0;
        margin: 0 -12px 18px;
      }
      .meta-grid td { width: 50%; vertical-align: top; }
      .meta-card {
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
      }
      .meta-card-accent {
        border-color: rgba(108, 77, 255, 0.28);
        background: linear-gradient(180deg, #fff 0%, rgba(248, 250, 252, 0.9) 100%);
      }
      .meta-card-title {
        padding: 11px 14px;
        background: ${BRAND.surface};
        border-bottom: 1px solid ${BRAND.border};
        font-size: 11px;
        font-weight: 800;
        color: ${BRAND.primaryDark};
        letter-spacing: 0.3px;
      }
      .meta-row {
        padding: 10px 14px;
        border-bottom: 1px solid ${BRAND.border};
      }
      .meta-row:last-child { border-bottom: none; }
      .meta-label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
        margin-bottom: 3px;
      }
      .meta-value {
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: ${BRAND.text};
        word-break: break-word;
      }
      .section-head-wrap {
        margin: 4px 0 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid rgba(108, 77, 255, 0.12);
      }
      .section-head {
        margin: 0 0 4px;
        font-size: 15px;
        font-weight: 800;
        color: ${BRAND.text};
      }
      .section-sub {
        margin: 0;
        font-size: 11px;
        color: ${BRAND.textSecondary};
      }
      table.items {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid ${BRAND.border};
        border-radius: 14px;
        overflow: hidden;
        font-size: 10px;
        table-layout: fixed;
        margin-bottom: 18px;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
      }
      table.items thead th {
        background: linear-gradient(180deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%);
        color: #fff;
        font-weight: 700;
        padding: 12px 8px;
        border-bottom: 1px solid ${BRAND.primaryDark};
        font-size: 10px;
        letter-spacing: 0.2px;
      }
      table.items tbody td {
        padding: 11px 8px;
        border-bottom: 1px solid ${BRAND.border};
        vertical-align: top;
      }
      table.items tbody tr:nth-child(even) td { background: ${BRAND.surface}; }
      table.items tbody tr:last-child td { border-bottom: none; }
      .col-index { width: 5%; }
      .col-product { width: 28%; }
      .col-size { width: 14%; }
      .col-thickness { width: 10%; }
      .col-qty { width: 7%; }
      .col-unit { width: 16%; }
      .col-line { width: 16%; }
      .center { text-align: center; }
      .ltr { direction: ltr; unicode-bidi: embed; }
      .amount-cell { text-align: ${totalsAlign}; white-space: nowrap; }
      .amount { font-weight: 800; color: ${BRAND.primaryDark}; }
      .product-name { font-weight: 700; color: ${BRAND.text}; line-height: 1.4; }
      .item-note { margin-top: 4px; font-size: 9px; color: ${BRAND.textSecondary}; line-height: 1.35; }
      .invoice-note-wrap {
        margin-top: 14px;
        padding: 12px 14px;
        border: 1px solid rgba(108, 77, 255, 0.14);
        border-radius: 12px;
        background: ${BRAND.surface};
      }
      .invoice-note-title {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        color: ${BRAND.textSecondary};
        margin-bottom: 6px;
      }
      .invoice-note-body {
        font-size: 11px;
        line-height: 1.5;
        color: ${BRAND.text};
        white-space: pre-wrap;
      }
      .summary-wrap { width: 100%; margin-top: 6px; }
      .summary-table {
        width: 320px;
        margin-${options.isRtl ? 'right' : 'left'}: auto;
        margin-${options.isRtl ? 'left' : 'right'}: 0;
        border-collapse: collapse;
        border: 1px solid rgba(108, 77, 255, 0.18);
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
      }
      .summary-table td {
        padding: 10px 16px;
        font-size: 12px;
        border-bottom: 1px solid ${BRAND.border};
      }
      .summary-table tr:last-child td { border-bottom: none; }
      .summary-label {
        color: ${BRAND.textSecondary};
        font-weight: 700;
        width: 58%;
      }
      .summary-value {
        text-align: ${totalsAlign};
        font-weight: 800;
        color: ${BRAND.text};
      }
      .summary-discount { color: ${BRAND.success}; }
      .summary-grand td {
        background: linear-gradient(180deg, rgba(108, 77, 255, 0.08), rgba(108, 77, 255, 0.03));
        border-top: 2px solid ${BRAND.primary};
      }
      .summary-total .amount { font-size: 17px; color: ${BRAND.primaryDark}; }
      .summary-remaining .amount { color: ${BRAND.success}; }
      .footer {
        margin-top: 30px;
        padding: 16px 12px 4px;
        border-top: 1px solid ${BRAND.border};
        text-align: center;
        background: linear-gradient(180deg, transparent, rgba(248, 250, 252, 0.85));
        border-radius: 12px;
      }
      .footer-text {
        margin: 0 0 6px;
        font-size: 12px;
        font-weight: 600;
        color: ${BRAND.textSecondary};
      }
      .footer-phones {
        margin: 0;
        font-size: 13px;
        font-weight: 800;
        color: ${BRAND.primaryDark};
        direction: ltr;
        unicode-bidi: embed;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header-band">
        <div class="top-bar"></div>

        <table class="header-table">
          <tr>
            <td class="brand-cell">
              <div class="brand-wrap">
                <div class="brand-logo-cell">${logoHtml}</div>
                <div class="brand-info">
                  <h1 class="brand-name">${appName}</h1>
                  <p class="brand-tagline">${escapeHtml(t('mirrorInvoiceTagline'))}</p>
                  <p class="brand-phones">${contactPhonesHtml}</p>
                </div>
              </div>
            </td>
            <td class="badge-cell">${invoiceBadgeHtml}</td>
          </tr>
        </table>
      </div>

      <table class="meta-grid">
        <tr>
          ${
            customerCardHtml && invoiceCardHtml
              ? `<td>${customerCardHtml}</td><td>${invoiceCardHtml}</td>`
              : customerCardHtml
                ? `<td colspan="2">${customerCardHtml}</td>`
                : invoiceCardHtml
                  ? `<td colspan="2">${invoiceCardHtml}</td>`
                  : ''
          }
        </tr>
      </table>

      <div class="section-head-wrap">
        <h2 class="section-head">${escapeHtml(t('mirrorInvoiceItemsTitle'))}</h2>
        <p class="section-sub">${escapeHtml(t('mirrorInvoiceItemsCount', {count: lineCount}))}</p>
      </div>

      <table class="items">
        <tbody>${invoiceItemRows}</tbody>
      </table>

      ${invoiceNoteHtml}

      <div class="summary-wrap">
        <table class="summary-table">
          <tbody>${summaryRows}</tbody>
        </table>
      </div>

      <div class="footer">
        <p class="footer-text">${escapeHtml(t('mirrorCartPdfFooter'))}</p>
        <p class="footer-phones">${contactPhonesHtml}</p>
      </div>
    </div>
  </body>
</html>`;
}

function buildFileStem(customerName: string): string {
  const safeName = customerName.replace(/[^\w\u0600-\u06FF-]+/g, '-').replace(/^-+|-+$/g, '');
  return safeName ? `mirror-quote-${safeName}` : 'mirror-quote';
}

function resolveMirrorCartItemLabel(t: TFunction, item: Pick<MirrorPricingCartItem, 'labelKey'>): string {
  const key = item.labelKey?.trim();
  if (!key) {
    return t('mirrorCartUnknownItem');
  }
  return t(key);
}

function normalizeExportItems(items: MirrorPricingCartItem[]): MirrorPricingCartItem[] {
  return items
    .map((item) => normalizeMirrorPricingCartItem(item))
    .filter((item): item is MirrorPricingCartItem => item !== null);
}

function normalizeExportCustomAdditions(
  customAdditions: MirrorPricingCustomAddition[] | undefined,
): MirrorPricingCustomAddition[] {
  if (!customAdditions?.length) {
    return [];
  }
  return customAdditions
    .map((entry) => normalizeMirrorPricingCustomAddition(entry))
    .filter((entry): entry is MirrorPricingCustomAddition => entry !== null);
}

async function printHtmlToPdf(html: string): Promise<Print.FilePrintResult> {
  try {
    return await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
      base64: true,
    });
  } catch (error) {
    console.error('[exportMirrorCartReport] printToFileAsync failed', error);
    throw new Error('PDF generation failed');
  }
}

export async function exportMirrorCartReport(
  data: MirrorCartExportData,
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  const exportOptions: ExportOptions = {
    ...options,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  };
  const normalizedData: MirrorCartExportData = {
    ...data,
    items: normalizeExportItems(data.items),
    customAdditions: normalizeExportCustomAdditions(data.customAdditions),
    extraInvoiceLines: options.extraInvoiceLines ?? data.extraInvoiceLines,
    invoiceNote: options.invoiceNote ?? data.invoiceNote,
  };
  const fileStem = buildFileStem(normalizedData.customerName);

  let logoDataUri = await loadLogoDataUri();
  let html = buildMirrorCartReportHtml(normalizedData, t, logoDataUri, exportOptions);

  let result: Print.FilePrintResult;
  try {
    result = await printHtmlToPdf(html);
  } catch (firstError) {
    if (!logoDataUri) {
      throw firstError;
    }
    console.warn('[exportMirrorCartReport] retrying PDF without logo');
    logoDataUri = '';
    html = buildMirrorCartReportHtml(normalizedData, t, logoDataUri, exportOptions);
    result = await printHtmlToPdf(html);
  }

  try {
    const shareUri = await prepareShareablePdf(result, fileStem);
    await sharePdfFile(shareUri, options.shareDialogTitle ?? t('mirrorCartExportPdfShare'));
  } catch (error) {
    console.error('[exportMirrorCartReport] share failed', error);
    throw new Error('Could not open share dialog');
  }
}

export async function exportMirrorConfirmedOrderReport(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  await exportMirrorCartReport(
    {
      invoiceNumber: order.invoiceNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerLocation: order.customerLocation,
      customerNotes: undefined,
      customerPhotosLink: order.customerPhotosLink,
      confirmedByUserName: order.confirmedByUserName,
      confirmedByUserRole: order.confirmedByUserRole,
      collectedAmount: order.collectedAmount,
      items: order.items,
      customAdditions: order.customAdditions,
      subtotal: resolveConfirmedOrderSubtotal(order),
      discountAmount: (() => {
        const discount = resolveConfirmedOrderDiscount(order);
        return discount > 0 ? discount : undefined;
      })(),
      total: order.total,
      extraInvoiceLines: options.extraInvoiceLines ?? order.invoiceExtraLines,
      invoiceNote: options.invoiceNote ?? order.invoiceNote,
    },
    t,
    {
      ...options,
      documentTitle: options.documentTitle ?? t('mirrorOrderInvoiceTitle'),
      generatedAt: order.confirmedAt,
      shareDialogTitle: options.shareDialogTitle ?? t('mirrorOrderExportInvoiceShare'),
    },
  );
}
