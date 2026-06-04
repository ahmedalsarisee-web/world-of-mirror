import {Asset} from 'expo-asset';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
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
import type {MirrorPricingCartItem} from '@app/types/mirrorPricingCart';
import {formatCurrency, formatDateTime} from '@app/utils/format';
import {getMirrorPricingCartCount, getMirrorPricingCartSubtotal} from '@app/stores/mirrorPricingCartStore';

const LOGO = require('../../assets/android-icon-foreground.png');

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
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  collectedAmount: number;
  items: MirrorPricingCartItem[];
  subtotal?: number;
  discountAmount?: number;
  total?: number;
}

interface ExportOptions {
  isRtl?: boolean;
  appName?: string;
  documentTitle?: string;
  generatedAt?: string;
  shareDialogTitle?: string;
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

function infoRow(label: string, value: string): string {
  if (!value.trim()) {
    return '';
  }
  return `
    <tr>
      <td class="info-label">${escapeHtml(label)}</td>
      <td class="info-value">${escapeHtml(value)}</td>
    </tr>
  `;
}

async function loadLogoDataUri(): Promise<string> {
  try {
    const asset = Asset.fromModule(LOGO);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) {
      return '';
    }

    const resized = await manipulateAsync(
      uri,
      [{resize: {width: 96}}],
      {compress: 0.85, format: SaveFormat.PNG, base64: true},
    );

    if (!resized.base64) {
      return '';
    }

    return `data:image/png;base64,${resized.base64}`;
  } catch (error) {
    console.warn('[exportMirrorCartReport] logo load failed', error);
    return '';
  }
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
  const {customerName, customerPhone, customerLocation, collectedAmount, items} = data;
  const currencyLabel = t('currencyLabel');
  const subtotal = data.subtotal ?? getMirrorPricingCartSubtotal(items);
  const total = data.total ?? subtotal;
  const discountAmount = data.discountAmount ?? Math.max(0, subtotal - total);
  const count = getMirrorPricingCartCount(items);
  const remaining = Math.max(0, total - collectedAmount);
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const logoPadding = options.isRtl ? 'padding-left:16px;' : 'padding-right:16px;';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const documentTitle = escapeHtml(options.documentTitle ?? t('mirrorCartPdfTitle'));
  const exportDateIso = options.generatedAt ?? new Date().toISOString();
  const exportDate = formatDateTime(exportDateIso);
  const isInvoice = (options.documentTitle ?? t('mirrorCartPdfTitle')) === t('mirrorOrderInvoiceTitle');
  const invoiceDateLabel = isInvoice ? t('mirrorCartPdfInvoiceDate') : t('mirrorCartPdfGeneratedAt');
  const sortedItems = [...items].reverse();

  const documentInfoRows = infoRow(invoiceDateLabel, exportDate);

  const customerRows = [
    infoRow(t('customerName'), customerName),
    infoRow(t('mirrorCartCustomerPhone'), customerPhone),
    infoRow(t('mirrorCartLocation'), customerLocation),
    collectedAmount > 0
      ? infoRow(t('mirrorCartCollectedAmount'), formatCurrency(collectedAmount, currencyLabel))
      : '',
  ]
    .filter(Boolean)
    .join('');

  const itemRows = sortedItems
    .map((item, index) => {
      const lineTotal = item.unitPrice * item.quantity;
      const thickness =
        item.thickness === '4mm' ? t('mirrorCartPdfThickness4mm') : t('mirrorCartPdfThickness6mm');
      const noteHtml = item.note
        ? `<br/><span class="muted">${escapeHtml(item.note)}</span>`
        : '';
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';

      return `
        <tr class="${rowClass}">
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(t(item.labelKey))}${noteHtml}</td>
          <td class="center ltr">${item.lengthCm} × ${item.widthCm} ${escapeHtml(t('mirrorUnitCm'))}</td>
          <td class="center">${escapeHtml(thickness)}</td>
          <td class="center">${item.quantity}</td>
          <td class="amount-cell">${amountCell(item.unitPrice, currencyLabel)}</td>
          <td class="amount-cell">${amountCell(lineTotal, currencyLabel)}</td>
        </tr>
      `;
    })
    .join('');

  const discountRow =
    discountAmount > 0
      ? `
        <tr>
          <td class="total-label">${escapeHtml(t('mirrorCartSubtotal'))}</td>
          <td class="total-value">${amountCell(subtotal, currencyLabel)}</td>
        </tr>
        <tr>
          <td class="total-label">${escapeHtml(t('mirrorCartDiscount'))}</td>
          <td class="total-value discount">− ${escapeHtml(formatCurrency(discountAmount, currencyLabel))}</td>
        </tr>
      `
      : '';

  const collectedRow =
    collectedAmount > 0
      ? `
        <tr>
          <td class="total-label">${escapeHtml(t('mirrorCartCollectedAmount'))}</td>
          <td class="total-value">${amountCell(collectedAmount, currencyLabel)}</td>
        </tr>
        <tr>
          <td class="total-label">${escapeHtml(t('mirrorCartRemainingAmount'))}</td>
          <td class="total-value highlight">${amountCell(remaining, currencyLabel)}</td>
        </tr>
      `
      : '';

  const logoHtml = logoDataUri ? `<img src="${logoDataUri}" alt="${appName}" class="logo" />` : '';

  return `<!DOCTYPE html>
<html lang="${options.isRtl ? 'ar' : 'en'}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 20px; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 16px;
        font-family: Arial, Helvetica, sans-serif;
        color: ${BRAND.text};
        background: #fff;
        direction: ${dir};
        text-align: ${align};
      }
      .header {
        padding: 16px 20px;
        border-radius: 12px;
        background: ${BRAND.primary};
        color: #fff;
        margin-bottom: 20px;
      }
      .header-table { width: 100%; border-collapse: collapse; }
      .header-table td { vertical-align: middle; }
      .logo-cell { width: 88px; ${logoPadding} }
      .logo {
        width: 72px;
        height: 72px;
        border-radius: 12px;
        background: #fff;
      }
      .header-text h1 {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: 700;
      }
      .header-text p {
        margin: 0 0 2px;
        font-size: 12px;
        opacity: 0.95;
      }
      .section {
        margin-bottom: 18px;
      }
      .section h2 {
        margin: 0 0 10px;
        font-size: 15px;
        color: ${BRAND.primaryDark};
      }
      .info-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid ${BRAND.border};
        border-radius: 10px;
        overflow: hidden;
      }
      .info-table td {
        padding: 10px 12px;
        border-bottom: 1px solid ${BRAND.border};
        font-size: 12px;
      }
      .info-table tr:last-child td { border-bottom: none; }
      .info-label {
        width: 34%;
        background: ${BRAND.surface};
        color: ${BRAND.textSecondary};
        font-weight: 600;
      }
      .info-value { color: ${BRAND.text}; }
      table.items {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid ${BRAND.border};
        font-size: 11px;
      }
      table.items th {
        background: ${BRAND.surface};
        color: ${BRAND.textSecondary};
        font-weight: 700;
        padding: 10px 8px;
        border-bottom: 1px solid ${BRAND.border};
      }
      table.items td {
        padding: 10px 8px;
        border-bottom: 1px solid ${BRAND.border};
        vertical-align: top;
      }
      .row-even { background: #fff; }
      .row-odd { background: ${BRAND.surface}; }
      .center { text-align: center; }
      .ltr { direction: ltr; unicode-bidi: embed; }
      .amount-cell { white-space: nowrap; }
      .amount { font-weight: 700; color: ${BRAND.primaryDark}; }
      .muted { color: ${BRAND.textSecondary}; font-size: 10px; }
      .totals {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
      }
      .totals td {
        padding: 8px 0;
        font-size: 13px;
      }
      .total-label {
        color: ${BRAND.textSecondary};
        font-weight: 600;
      }
      .total-value {
        text-align: ${options.isRtl ? 'left' : 'right'};
        font-weight: 700;
      }
      .total-value.highlight .amount { color: ${BRAND.success}; font-size: 16px; }
      .total-value.discount { color: ${BRAND.success}; font-weight: 700; }
      .grand-total {
        border-top: 2px solid ${BRAND.primary};
        padding-top: 10px !important;
      }
      .footer {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 1px solid ${BRAND.border};
        font-size: 11px;
        color: ${BRAND.textSecondary};
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <table class="header-table">
        <tr>
          <td class="logo-cell">${logoHtml}</td>
          <td class="header-text">
            <h1>${appName}</h1>
            <p>${documentTitle}</p>
          </td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('mirrorCartPdfDocumentInfo'))}</h2>
      <table class="info-table">${documentInfoRows}</table>
    </div>

    ${
      customerRows
        ? `
    <div class="section">
      <h2>${escapeHtml(t('mirrorCartCustomerInfo'))}</h2>
      <table class="info-table">${customerRows}</table>
    </div>`
        : ''
    }

    <div class="section">
      <h2>${escapeHtml(t('mirrorCartItemsSection'))} (${count})</h2>
      <table class="items">
        <thead>
          <tr>
            <th class="center">#</th>
            <th>${escapeHtml(t('mirrorCartPdfColProduct'))}</th>
            <th class="center">${escapeHtml(t('mirrorCartPdfColDimensions'))}</th>
            <th class="center">${escapeHtml(t('mirrorCartPdfColThickness'))}</th>
            <th class="center">${escapeHtml(t('quantity'))}</th>
            <th>${escapeHtml(t('mirrorCartPdfColUnitPrice'))}</th>
            <th>${escapeHtml(t('mirrorCartLineTotal'))}</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table class="totals">
        ${discountRow}
        <tr>
          <td class="total-label">${escapeHtml(t('mirrorCartFullPrice'))}</td>
          <td class="total-value grand-total highlight">${amountCell(total, currencyLabel)}</td>
        </tr>
        ${collectedRow}
      </table>
    </div>

    <div class="footer">${escapeHtml(t('mirrorCartPdfFooter'))} · ${appName}</div>
  </body>
</html>`;
}

function buildFileStem(customerName: string): string {
  const safeName = customerName.replace(/[^\w\u0600-\u06FF-]+/g, '-').replace(/^-+|-+$/g, '');
  return safeName ? `mirror-quote-${safeName}` : 'mirror-quote';
}

export async function exportMirrorCartReport(
  data: MirrorCartExportData,
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildMirrorCartReportHtml(data, t, logoDataUri, {
    ...options,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
  });
  const fileStem = buildFileStem(data.customerName);

  const result = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    base64: true,
  });
  const shareUri = await prepareShareablePdf(result, fileStem);
  await sharePdfFile(shareUri, options.shareDialogTitle ?? t('mirrorCartExportPdfShare'));
}

export async function exportMirrorConfirmedOrderReport(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  await exportMirrorCartReport(
    {
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerLocation: order.customerLocation,
      collectedAmount: order.collectedAmount,
      items: order.items,
      subtotal: resolveConfirmedOrderSubtotal(order),
      discountAmount: (() => {
        const discount = resolveConfirmedOrderDiscount(order);
        return discount > 0 ? discount : undefined;
      })(),
      total: order.total,
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
