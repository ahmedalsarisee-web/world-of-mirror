import {Asset} from 'expo-asset';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {resolveMirrorPricingOrderStatusLabel} from '@app/utils/ordersHomeCardLabels';
import {resolveConfirmedOrderRemaining} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {
  OrdersFinancialReportCardSection,
  OrdersFinancialReportData,
  OrdersFinancialReportSummary,
} from '@app/utils/ordersFinancialReport';
import {CURRENCY, formatCurrency, formatDateTime} from '@app/utils/format';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';

const LOGO = require('../../assets/android-icon-foreground.png');
const MAX_ORDERS_PER_CARD_DETAIL = 80;

const BRAND = {
  primary: '#6C4DFF',
  primaryDark: '#4338CA',
  primarySoft: '#EEF2FF',
  success: '#059669',
  successSoft: '#ECFDF5',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  white: '#FFFFFF',
};

interface ExportOptions {
  isRtl?: boolean;
  appName?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function amountCell(amount: number): string {
  const className = amount >= 0 ? 'amount-positive' : 'amount-negative';
  return `<span class="${className}">${escapeHtml(formatCurrency(amount))}</span>`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${Math.round(value)}%`;
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
    console.warn('[exportOrdersFinancialReport] logo load failed', error);
    return '';
  }
}

function buildExecutiveSummaryHtml(summary: OrdersFinancialReportSummary, t: TFunction): string {
  const collectionRate =
    summary.totalSales > 0 ? (summary.totalCollected / summary.totalSales) * 100 : 0;
  const collectionWidth = Math.max(0, Math.min(100, collectionRate));

  return `
    <div class="executive-summary">
    <table class="kpi-table" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td class="kpi-cell kpi-sales">
          <div class="kpi-label">${escapeHtml(t('ordersFinancialReportTotalSales'))}</div>
          <div class="kpi-value">${escapeHtml(formatCurrency(summary.totalSales))}</div>
        </td>
        <td class="kpi-cell kpi-collected">
          <div class="kpi-label">${escapeHtml(t('ordersFinancialReportTotalCollected'))}</div>
          <div class="kpi-value">${escapeHtml(formatCurrency(summary.totalCollected))}</div>
        </td>
        <td class="kpi-cell kpi-outstanding">
          <div class="kpi-label">${escapeHtml(t('ordersFinancialReportTotalRemaining'))}</div>
          <div class="kpi-value">${escapeHtml(formatCurrency(summary.totalRemaining))}</div>
        </td>
      </tr>
    </table>
    <table class="meta-table" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td class="mini-metric">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportOrderCount'))}</div>
          <div class="mini-metric-value">${summary.orderCount}</div>
        </td>
        <td class="mini-metric">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportTotalPieces'))}</div>
          <div class="mini-metric-value">${summary.mirrorItemCount}</div>
        </td>
        <td class="mini-metric">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportCollectionRate'))}</div>
          <div class="mini-metric-value">${formatPercent(collectionRate)}</div>
        </td>
      </tr>
    </table>
    <div class="collection-progress-label">
      <span>${escapeHtml(t('ordersFinancialReportCollectionsSection'))}</span>
      <span>${formatPercent(collectionRate)}</span>
    </div>
    <table class="progress-table" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td class="progress-track">
          <table width="${collectionWidth}%" cellspacing="0" cellpadding="0">
            <tr><td class="progress-fill">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
    </table>
    </div>
  `;
}

function buildCardMiniSummaryHtml(section: OrdersFinancialReportCardSection, t: TFunction): string {
  return `
    <table class="meta-table" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td class="mini-metric" width="25%">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportOrderCount'))}</div>
          <div class="mini-metric-value">${section.orderCount}</div>
        </td>
        <td class="mini-metric" width="25%">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportOrderValue'))}</div>
          <div class="mini-metric-value">${escapeHtml(formatCurrency(section.totalSales))}</div>
        </td>
        <td class="mini-metric" width="25%">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportCashCollected'))}</div>
          <div class="mini-metric-value">${escapeHtml(formatCurrency(section.totalCollected))}</div>
        </td>
        <td class="mini-metric" width="25%">
          <div class="mini-metric-label">${escapeHtml(t('ordersFinancialReportCustomerOutstanding'))}</div>
          <div class="mini-metric-value">${escapeHtml(formatCurrency(section.totalRemaining))}</div>
        </td>
      </tr>
    </table>
  `;
}

function buildOrdersTableHtml(
  orders: MirrorPricingConfirmedOrder[],
  t: TFunction,
  homeCards: ReturnType<typeof resolveOrdersHomeCards>,
): string {
  if (orders.length === 0) {
    return `<p class="empty-card-note">${escapeHtml(t('ordersFinancialReportNoOrdersInCard'))}</p>`;
  }

  const visibleOrders = orders.slice(0, MAX_ORDERS_PER_CARD_DETAIL);
  const hiddenCount = orders.length - visibleOrders.length;

  const rows = visibleOrders
    .map((order, index) => {
      const invoice = formatMirrorOrderInvoiceLabel(order.invoiceNumber) ?? '—';
      const statusLabel = resolveMirrorPricingOrderStatusLabel(
        resolveMirrorPricingOrderStatus(order.status),
        homeCards,
        t,
      );
      const remaining = resolveConfirmedOrderRemaining(order);
      const phone = order.customerPhone?.trim() || '—';

      return `
        <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td>${escapeHtml(invoice)}</td>
          <td>${escapeHtml(formatDateTime(order.confirmedAt))}</td>
          <td>${escapeHtml(order.customerName || t('mirrorOrdersNoCustomerName'))}</td>
          <td class="ltr">${escapeHtml(phone)}</td>
          <td>${escapeHtml(statusLabel)}</td>
          <td>${escapeHtml(order.confirmedByUserName ?? '—')}</td>
          <td class="amount-cell amount-sales">${amountCell(order.total)}</td>
          <td class="amount-cell amount-collected">${amountCell(order.collectedAmount)}</td>
          <td class="amount-cell amount-outstanding">${amountCell(remaining)}</td>
        </tr>
      `;
    })
    .join('');

  const truncatedNote =
    hiddenCount > 0
      ? `<p class="overview-note">${escapeHtml(
          t('ordersFinancialReportOrdersTruncated', {
            shown: visibleOrders.length,
            total: orders.length,
          }),
        )}</p>`
      : '';

  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(t('ordersSearchFieldInvoice'))}</th>
          <th>${escapeHtml(t('ordersSearchFieldDate'))}</th>
          <th>${escapeHtml(t('ordersSearchFieldCustomer'))}</th>
          <th>${escapeHtml(t('ordersSearchFieldPhone'))}</th>
          <th>${escapeHtml(t('ordersFinancialReportStage'))}</th>
          <th>${escapeHtml(t('ordersFinancialReportConfirmedBy'))}</th>
          <th>${escapeHtml(t('ordersFinancialReportOrderValue'))}</th>
          <th>${escapeHtml(t('ordersFinancialReportCashCollected'))}</th>
          <th>${escapeHtml(t('ordersFinancialReportCustomerOutstanding'))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${truncatedNote}
  `;
}

function buildCardOverviewRows(
  byCard: OrdersFinancialReportCardSection[],
  summary: OrdersFinancialReportSummary,
  t: TFunction,
): string {
  const cardRows = byCard
    .map((section, index) => {
      return `
        <tr class="${index % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td>${escapeHtml(section.cardLabel)}</td>
          <td class="center">${section.orderCount}</td>
          <td class="amount-cell amount-sales">${amountCell(section.totalSales)}</td>
          <td class="amount-cell amount-collected">${amountCell(section.totalCollected)}</td>
          <td class="amount-cell amount-outstanding">${amountCell(section.totalRemaining)}</td>
        </tr>
      `;
    })
    .join('');

  const totalRow = `
    <tr class="overview-total-row">
      <td>${escapeHtml(t('ordersFinancialReportSnapshotTotal'))}</td>
      <td class="center">${summary.orderCount}</td>
      <td class="amount-cell amount-sales">${amountCell(summary.totalSales)}</td>
      <td class="amount-cell amount-collected">${amountCell(summary.totalCollected)}</td>
      <td class="amount-cell amount-outstanding">${amountCell(summary.totalRemaining)}</td>
    </tr>
  `;

  return `${cardRows}${totalRow}`;
}

function buildCardDetailSectionsHtml(
  byCard: OrdersFinancialReportCardSection[],
  t: TFunction,
  homeCards: ReturnType<typeof resolveOrdersHomeCards>,
  includeOrderDetails: boolean,
): string {
  return byCard
    .filter((section) => section.orderCount > 0)
    .map((section) => {
      const ordersDetailHtml = includeOrderDetails
        ? `
          <h3 class="subsection-title">${escapeHtml(t('ordersFinancialReportOrdersDetail'))}</h3>
          ${buildOrdersTableHtml(section.orders, t, homeCards)}
        `
        : '';

      return `
        <div class="card-detail-section">
          <table class="card-header-table" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td><h2>${escapeHtml(section.cardLabel)}</h2></td>
              <td class="card-detail-badge-cell"><span class="card-detail-badge">${section.orderCount}</span></td>
            </tr>
          </table>
          <h3 class="subsection-title">${escapeHtml(t('ordersFinancialReportCardSummary'))}</h3>
          ${buildCardMiniSummaryHtml(section, t)}
          ${ordersDetailHtml}
        </div>
      `;
    })
    .join('');
}

interface BuildHtmlOptions extends ExportOptions {
  includeOrderDetails?: boolean;
  includeLogo?: boolean;
}

function buildOrdersFinancialReportHtml(
  data: OrdersFinancialReportData,
  t: TFunction,
  logoDataUri: string,
  options: BuildHtmlOptions,
): string {
  const {summary, byCard} = data;
  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const logoPadding = options.isRtl ? 'padding-left:16px;' : 'padding-right:16px;';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const exportDate = dayjs().format('YYYY-MM-DD HH:mm');
  const includeOrderDetails = options.includeOrderDetails !== false;
  const includeLogo = options.includeLogo !== false && Boolean(logoDataUri);

  const logoHtml = includeLogo
    ? `<img src="${logoDataUri}" alt="${appName}" class="logo" />`
    : '';

  const cardOverviewRows = buildCardOverviewRows(byCard, summary, t);
  const cardDetailSections = buildCardDetailSectionsHtml(byCard, t, homeCards, includeOrderDetails);

  return `<!DOCTYPE html>
<html lang="${options.isRtl ? 'ar' : 'en'}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 18px; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 14px;
        font-family: Arial, Helvetica, sans-serif;
        color: ${BRAND.text};
        background: ${BRAND.white};
        direction: ${dir};
        text-align: ${align};
        font-size: 10px;
        line-height: 1.45;
      }
      .header {
        padding: 18px 20px;
        border-radius: 12px;
        background: ${BRAND.primary};
        color: #fff;
        margin-bottom: 18px;
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
      .header-text h1 { margin: 0 0 4px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
      .header-text .header-app { margin: 0 0 8px; font-size: 13px; opacity: 0.94; }
      .header-text .header-meta { margin: 0 0 3px; font-size: 11px; opacity: 0.88; }
      .section {
        margin-bottom: 18px;
        border: 1px solid ${BRAND.border};
        border-radius: 12px;
        padding: 16px;
        background: ${BRAND.white};
      }
      h2 {
        font-size: 15px;
        margin: 0;
        color: ${BRAND.primaryDark};
        font-weight: 800;
      }
      .section-title {
        font-size: 15px;
        margin: 0 0 12px;
        color: ${BRAND.primaryDark};
        font-weight: 800;
        padding-bottom: 8px;
        border-bottom: 2px solid ${BRAND.primary};
      }
      .subsection-title {
        font-size: 11px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
        margin: 14px 0 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid ${BRAND.border};
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .executive-summary {
        border: 1px solid ${BRAND.border};
        border-radius: 12px;
        padding: 12px;
        background: ${BRAND.surface};
        margin-bottom: 12px;
      }
      .kpi-table { margin-bottom: 10px; border-collapse: separate; border-spacing: 8px 0; }
      .kpi-cell {
        width: 33%;
        border-radius: 10px;
        padding: 12px 8px;
        border: 1px solid ${BRAND.border};
        text-align: center;
        vertical-align: top;
      }
      .kpi-sales { background: ${BRAND.primarySoft}; border-color: #C7D2FE; }
      .kpi-collected { background: ${BRAND.successSoft}; border-color: #86EFAC; }
      .kpi-outstanding { background: ${BRAND.warningSoft}; border-color: #FCD34D; }
      .kpi-label {
        font-size: 10px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
        margin-bottom: 8px;
      }
      .kpi-value {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.15;
      }
      .kpi-sales .kpi-value { color: ${BRAND.primaryDark}; }
      .kpi-collected .kpi-value { color: ${BRAND.success}; }
      .kpi-outstanding .kpi-value { color: ${BRAND.warning}; }
      .meta-table { margin-bottom: 10px; border-collapse: separate; border-spacing: 8px 0; }
      .summary-meta {
        margin-bottom: 10px;
      }
      .mini-metric {
        width: 33%;
        background: ${BRAND.white};
        border: 1px solid ${BRAND.border};
        border-radius: 10px;
        padding: 10px;
        text-align: center;
        vertical-align: top;
      }
      .mini-metric-label {
        font-size: 9px;
        color: ${BRAND.textSecondary};
        margin-bottom: 4px;
        font-weight: 700;
      }
      .mini-metric-value {
        font-size: 13px;
        font-weight: 800;
        color: ${BRAND.text};
      }
      .collection-progress-label {
        font-size: 10px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
        margin: 8px 0 6px;
      }
      .progress-table { margin-bottom: 4px; }
      .progress-track {
        height: 8px;
        border-radius: 999px;
        background: ${BRAND.border};
        overflow: hidden;
      }
      .progress-fill {
        height: 8px;
        background: ${BRAND.success};
      }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid ${BRAND.border};
        font-size: 9px;
      }
      thead th {
        background: ${BRAND.primaryDark};
        color: #fff;
        font-weight: 700;
        padding: 8px 6px;
        text-align: ${align};
      }
      tbody td {
        padding: 8px 6px;
        border-top: 1px solid ${BRAND.border};
        vertical-align: top;
      }
      .center { text-align: center; }
      .row-even { background: #fff; }
      .row-odd { background: ${BRAND.surface}; }
      .overview-total-row {
        background: ${BRAND.primarySoft};
        font-weight: 800;
      }
      .overview-total-row td {
        border-top: 2px solid ${BRAND.primary};
      }
      .amount-cell { white-space: nowrap; font-weight: 700; }
      .amount-positive { color: ${BRAND.success}; }
      .amount-negative { color: ${BRAND.danger}; }
      .amount-sales .amount-positive { color: ${BRAND.primaryDark}; }
      .amount-collected .amount-positive { color: ${BRAND.success}; }
      .amount-outstanding .amount-positive { color: ${BRAND.warning}; }
      .ltr { direction: ltr; text-align: left; }
      .card-detail-section {
        margin-bottom: 18px;
        border: 1px solid ${BRAND.border};
        border-radius: 12px;
        padding: 16px;
        background: ${BRAND.white};
      }
      .card-header-table td { vertical-align: middle; }
      .card-detail-badge-cell { width: 48px; text-align: center; }
      .card-detail-badge {
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        border-radius: 999px;
        background: ${BRAND.primarySoft};
        color: ${BRAND.primaryDark};
        font-size: 11px;
        font-weight: 800;
        text-align: center;
        line-height: 28px;
      }
      .empty-card-note {
        margin: 0;
        padding: 12px;
        border-radius: 10px;
        background: ${BRAND.surface};
        color: ${BRAND.textSecondary};
        text-align: center;
        font-style: italic;
      }
      .overview-note {
        margin: 10px 0 0;
        font-size: 9px;
        color: ${BRAND.textSecondary};
        font-style: italic;
      }
      .footer {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid ${BRAND.border};
        font-size: 9px;
        color: ${BRAND.textSecondary};
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <table class="header-table">
        <tr>
          ${logoDataUri && includeLogo ? `<td class="logo-cell">${logoHtml}</td>` : ''}
          <td>
            <div class="header-text">
              <h1>${escapeHtml(t('ordersFinancialReportTitle'))}</h1>
              <p class="header-app">${appName}</p>
              <p class="header-meta">${escapeHtml(t('ordersFinancialReportSnapshotAsOf'))}: ${escapeHtml(exportDate)}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(t('ordersFinancialReportExecutiveSummary'))}</div>
      ${buildExecutiveSummaryHtml(summary, t)}
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(t('ordersFinancialReportCardsOverview'))}</div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('ordersFinancialReportByCard'))}</th>
            <th>${escapeHtml(t('ordersFinancialReportOrderCount'))}</th>
            <th>${escapeHtml(t('ordersFinancialReportOrderValue'))}</th>
            <th>${escapeHtml(t('ordersFinancialReportCashCollected'))}</th>
            <th>${escapeHtml(t('ordersFinancialReportCustomerOutstanding'))}</th>
          </tr>
        </thead>
        <tbody>${cardOverviewRows}</tbody>
      </table>
      <p class="overview-note">${escapeHtml(t('ordersFinancialReportCardsOverviewNote'))}</p>
    </div>

    ${cardDetailSections}

    <div class="footer">${escapeHtml(t('ordersFinancialReportFooter'))} · ${CURRENCY}</div>
  </body>
</html>`;
}

async function printHtmlToPdf(html: string): Promise<Print.FilePrintResult> {
  return Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
    base64: true,
  });
}

export async function exportOrdersFinancialReport(
  data: OrdersFinancialReportData,
  t: TFunction,
  options: ExportOptions,
): Promise<void> {
  let logoDataUri = await loadLogoDataUri();
  const buildHtml = (htmlOptions: BuildHtmlOptions) =>
    buildOrdersFinancialReportHtml(data, t, logoDataUri, {...options, ...htmlOptions});

  let result: Print.FilePrintResult;
  try {
    result = await printHtmlToPdf(buildHtml({includeLogo: true, includeOrderDetails: true}));
  } catch (firstError) {
    console.warn('[exportOrdersFinancialReport] full PDF failed, retrying without logo', firstError);
    try {
      logoDataUri = '';
      result = await printHtmlToPdf(buildHtml({includeLogo: false, includeOrderDetails: true}));
    } catch (secondError) {
      console.warn(
        '[exportOrdersFinancialReport] detailed PDF failed, retrying overview only',
        secondError,
      );
      try {
        result = await printHtmlToPdf(buildHtml({includeLogo: false, includeOrderDetails: false}));
      } catch (thirdError) {
        console.error('[exportOrdersFinancialReport] printToFileAsync failed', thirdError);
        throw new Error('PDF generation failed');
      }
    }
  }

  try {
    const shareUri = await prepareShareablePdf(result, 'orders-financial-report');
    await sharePdfFile(shareUri, t('ordersFinancialReportExport'));
  } catch (error) {
    console.error('[exportOrdersFinancialReport] share failed', error);
    throw new Error('Could not open share dialog');
  }
}
