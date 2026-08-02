import {Asset} from 'expo-asset';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {AdminBackupSnapshot} from '@app/services/adminBackupData.service';
import type {AppUser, AttendanceEventType, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveMirrorPricingOrderStatus,
} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatusLabel} from '@app/utils/ordersHomeCardLabels';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {resolveConfirmedOrderRemaining} from '@app/types/mirrorPricingConfirmedOrder';
import {getCustomAdditionLineTotal} from '@app/types/mirrorPricingCart';
import {CURRENCY, formatCurrency, formatDateTime} from '@app/utils/format';
import {buildFinanceReportData} from '@app/utils/financeReportData';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {getTransactionTypeLabel} from '@app/utils/transactionLabels';

const LOGO = require('../../assets/android-icon-foreground.png');

const BRAND = {
  primary: '#6C4DFF',
  primaryDark: '#5738F5',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#F59E0B',
  text: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  surface: '#F8FAFC',
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
    console.warn('[exportAdminBackupReport] logo load failed', error);
    return '';
  }
}

function amountCell(amount: number): string {
  const className = amount >= 0 ? 'amount-positive' : 'amount-negative';
  return `<span class="${className}">${escapeHtml(formatCurrency(amount))}</span>`;
}

function statCard(label: string, value: string): string {
  return `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${value}</div>
    </div>
  `;
}

function getAttendanceTypeLabel(type: AttendanceEventType, t: TFunction): string {
  switch (type) {
    case 'check_in':
      return t('checkIn');
    case 'check_out':
      return t('checkOut');
    case 'hours_reset':
      return t('adminBackupAttendanceHoursReset');
    case 'absent':
      return t('adminBackupAttendanceAbsent');
    default:
      return type;
  }
}

function resolveOrderSectionLabel(
  order: MirrorPricingConfirmedOrder,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  if (order.homeCardId) {
    const card = homeCards.find((entry) => entry.id === order.homeCardId);
    return card?.name ?? t('mirrorOrdersActionsMoveToCustomCard');
  }
  return resolveMirrorPricingOrderStatusLabel(
    resolveMirrorPricingOrderStatus(order.status),
    homeCards,
    t,
  );
}

function summarizeUserPermissions(user: AppUser, t: TFunction): string {
  if (user.role === 'admin') {
    const permissions = user.adminPermissions;
    const flags = [
      permissions?.showMirrorCartCostPrice ? t('permissionShowMirrorCartCostPrice') : null,
      permissions?.showEmployeeManagement ? t('permissionShowEmployeeManagement') : null,
      permissions?.showAllFinanceCards ? t('permissionShowAllFinanceCards') : null,
    ].filter(Boolean);
    if (user.isPrimaryAdmin) {
      return t('adminBackupPrimaryAdmin');
    }
    return flags.length > 0 ? flags.join(' · ') : '—';
  }

  const permissions = user.permissions;
  const flags = [
    permissions?.finance ? t('finance') : null,
    permissions?.moveOrders ? t('permissionMoveOrders') : null,
    permissions?.orderCardNotes ? t('permissionOrderCardNotes') : null,
    permissions?.editFinanceTransactions ? t('permissionEditFinanceTransactions') : null,
    permissions?.showNotificationsIcon ? t('permissionShowNotificationsIcon') : null,
    permissions?.employeeFinance ? t('permissionEmployeeFinance') : null,
    permissions?.employeeAttendance ? t('permissionEmployeeAttendance') : null,
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(' · ') : '—';
}

function resolveMirrorCartItemLabel(t: TFunction, labelKey: string): string {
  const key = labelKey?.trim();
  if (!key) {
    return '—';
  }
  const translated = t(key);
  return translated === key ? key : translated;
}

function buildOrderItemsBlock(order: MirrorPricingConfirmedOrder, t: TFunction): string {
  const lines: string[] = [];

  if (order.items.length > 0) {
    const itemLines = order.items.map((item, index) => {
      const label = resolveMirrorCartItemLabel(t, item.labelKey) || `${t('adminBackupOrderItem')} ${index + 1}`;
      const qty = item.quantity ?? 1;
      const unitPrice = formatCurrency(item.unitPrice ?? 0);
      const lineTotal = formatCurrency((item.unitPrice ?? 0) * qty);
      return `${escapeHtml(label)} × ${qty} @ ${escapeHtml(unitPrice)} = ${escapeHtml(lineTotal)}`;
    });
    lines.push(`<div class="detail-line"><strong>${escapeHtml(t('adminBackupOrderItems'))}:</strong> ${itemLines.join('<br/>')}</div>`);
  }

  if (order.customAdditions && order.customAdditions.length > 0) {
    const additionLines = order.customAdditions.map((entry) => {
      const label = entry.label?.trim() || '—';
      const total = formatCurrency(getCustomAdditionLineTotal(entry));
      return `${escapeHtml(label)}: ${escapeHtml(total)}`;
    });
    lines.push(
      `<div class="detail-line"><strong>${escapeHtml(t('adminBackupOrderCustomAdditions'))}:</strong> ${additionLines.join('<br/>')}</div>`,
    );
  }

  if (order.customerNotes?.trim()) {
    lines.push(
      `<div class="detail-line"><strong>${escapeHtml(t('notes'))}:</strong> ${escapeHtml(order.customerNotes.trim())}</div>`,
    );
  }

  if (order.paymentFollowUpRequired) {
    lines.push(
      `<div class="detail-line alert-line"><strong>${escapeHtml(t('mirrorOrdersPaymentFollowUpAlertA11y'))}:</strong> ${escapeHtml(order.paymentFollowUpNote?.trim() || '—')}</div>`,
    );
  }

  return lines.join('');
}

function buildAdminBackupHtml(
  snapshot: AdminBackupSnapshot,
  t: TFunction,
  logoDataUri: string,
  options: ExportOptions,
): string {
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const logoPadding = options.isRtl ? 'padding-left:16px;' : 'padding-right:16px;';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const exportDate = formatDateTime(snapshot.exportedAt);
  const userMap = new Map(snapshot.users.map((user) => [user.id, user]));
  const financeReport = buildFinanceReportData(snapshot.users, snapshot.transactions);

  const summaryStats = `
    <div class="stats-grid">
      ${statCard(t('adminBackupUsersCount'), String(snapshot.users.length))}
      ${statCard(t('adminBackupOrdersCount'), String(snapshot.orders.length))}
      ${statCard(t('exportTotalTransactions'), String(snapshot.transactions.length))}
      ${statCard(t('adminBackupAttendanceCount'), String(snapshot.attendance.length))}
      ${statCard(t('financeExportCurrentTotalBalance'), escapeHtml(formatCurrency(financeReport.summary.currentTotalBalance)))}
      ${statCard(t('adminBackupHomeCardsCount'), String(snapshot.ordersHomeCards.length))}
    </div>
  `;

  const userRows = snapshot.users
    .map((user, index) => {
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      const ledgerNames = (user.financeLedgers ?? [])
        .map((ledger) => ledger.name)
        .filter(Boolean)
        .join(' · ');
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.role === 'admin' ? t('adminRole') : t('employeeRole'))}</td>
          <td>${escapeHtml(user.email ?? '—')}</td>
          <td class="amount-cell">${amountCell(user.balance)}</td>
          <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
          <td>${escapeHtml(summarizeUserPermissions(user, t))}</td>
          <td>${escapeHtml(ledgerNames || '—')}</td>
        </tr>
      `;
    })
    .join('');

  const homeCardRows = snapshot.ordersHomeCards
    .map((card, index) => {
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      const kindLabel =
        card.kind === 'custom'
          ? t('adminBackupCustomCard')
          : t('adminBackupBuiltinCard');
      const target =
        card.kind === 'builtin'
          ? `${card.name} (${card.target})`
          : card.name;
      return `
        <tr class="${rowClass}">
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(kindLabel)}</td>
          <td>${escapeHtml(target)}</td>
          <td>${escapeHtml(card.kind === 'builtin' ? card.subtitle || '—' : '—')}</td>
        </tr>
      `;
    })
    .join('');

  const workplace = snapshot.attendanceWorkplace;
  const settingsBlock = `
    <div class="settings-box">
      <div class="settings-item">
        <div class="settings-label">${escapeHtml(t('settingsAttendanceWorkplaceTitle'))}</div>
        <div class="settings-value">${escapeHtml(workplace.name)}</div>
      </div>
      <div class="settings-item">
        <div class="settings-label">${escapeHtml(t('adminBackupWorkplaceCoords'))}</div>
        <div class="settings-value">${escapeHtml(`${workplace.latitude.toFixed(5)}, ${workplace.longitude.toFixed(5)}`)}</div>
      </div>
      <div class="settings-item">
        <div class="settings-label">${escapeHtml(t('adminBackupWorkplaceRadius'))}</div>
        <div class="settings-value">${escapeHtml(`${workplace.radiusMeters} m`)}</div>
      </div>
    </div>
  `;

  const sortedTransactions = [...snapshot.transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const transactionRows = sortedTransactions
    .map((tx, index) => buildTransactionRow(tx, userMap, index, t))
    .join('');

  const sortedOrders = [...snapshot.orders].sort((a, b) =>
    (b.confirmedAt || '').localeCompare(a.confirmedAt || ''),
  );
  const orderRows = sortedOrders
    .map((order, index) => {
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      const details = buildOrderItemsBlock(order, t);
      const invoice = formatMirrorOrderInvoiceLabel(order.invoiceNumber) ?? order.id;
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(invoice)}</td>
          <td>${escapeHtml(formatDateTime(order.confirmedAt))}</td>
          <td>${escapeHtml(order.customerName || '—')}</td>
          <td>${escapeHtml(order.customerPhone || '—')}</td>
          <td>${escapeHtml(resolveOrderSectionLabel(order, snapshot.ordersHomeCards, t))}</td>
          <td class="amount-cell">${amountCell(order.total)}</td>
          <td class="amount-cell">${amountCell(order.collectedAmount)}</td>
          <td class="amount-cell">${amountCell(resolveConfirmedOrderRemaining(order))}</td>
          <td>${escapeHtml(order.confirmedByUserName || '—')}</td>
        </tr>
        ${details ? `<tr class="detail-row"><td colspan="9">${details}</td></tr>` : ''}
      `;
    })
    .join('');

  const sortedAttendance = [...snapshot.attendance].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const attendanceRows = sortedAttendance
    .map((record, index) => {
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      const employee = userMap.get(record.userId);
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(formatDateTime(record.createdAt))}</td>
          <td>${escapeHtml(employee?.name ?? record.userId)}</td>
          <td>${escapeHtml(getAttendanceTypeLabel(record.type, t))}</td>
          <td>${escapeHtml(record.note || '—')}</td>
        </tr>
      `;
    })
    .join('');

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="${appName}" class="logo" />`
    : '';

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
        padding: 12px;
        font-family: Arial, Helvetica, sans-serif;
        color: ${BRAND.text};
        background: #fff;
        direction: ${dir};
        text-align: ${align};
        font-size: 10px;
      }
      .header {
        padding: 16px 20px;
        border-radius: 12px;
        background: ${BRAND.primary};
        color: #fff;
        margin-bottom: 18px;
      }
      .header-table { width: 100%; border-collapse: collapse; }
      .header-table td { vertical-align: middle; }
      .logo-cell { width: 88px; ${logoPadding} }
      .logo { width: 72px; height: 72px; border-radius: 12px; background: #fff; }
      .header-text h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
      .header-text p { margin: 0 0 2px; font-size: 11px; }
      .badge-backup {
        display: inline-block;
        margin-top: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.18);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.4px;
      }
      .section { margin-bottom: 22px; page-break-inside: avoid; }
      .section h2 {
        margin: 0 0 10px;
        font-size: 14px;
        font-weight: 700;
        color: ${BRAND.primaryDark};
        border-bottom: 2px solid ${BRAND.primary};
        padding-bottom: 4px;
      }
      .subsection {
        margin: 12px 0 8px;
        font-size: 11px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 8px;
      }
      .stat-card {
        border: 1px solid ${BRAND.border};
        border-radius: 10px;
        padding: 10px;
        background: ${BRAND.surface};
        text-align: center;
      }
      .stat-label { font-size: 9px; color: ${BRAND.textSecondary}; font-weight: 700; margin-bottom: 4px; }
      .stat-value { font-size: 14px; font-weight: 700; color: ${BRAND.text}; }
      .settings-box {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }
      .settings-item {
        border: 1px solid ${BRAND.border};
        border-radius: 10px;
        padding: 10px;
        background: ${BRAND.surface};
      }
      .settings-label { font-size: 9px; color: ${BRAND.textSecondary}; font-weight: 700; margin-bottom: 4px; }
      .settings-value { font-size: 11px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th, td {
        border: 1px solid ${BRAND.border};
        padding: 6px 7px;
        vertical-align: top;
        font-size: 9px;
      }
      th {
        background: ${BRAND.surface};
        color: ${BRAND.textSecondary};
        font-weight: 700;
      }
      .row-even { background: #fff; }
      .row-odd { background: #FAFBFC; }
      .detail-row td {
        background: #F8FAFF;
        border-top: none;
        padding-top: 0;
        padding-bottom: 8px;
      }
      .detail-line { margin-top: 4px; line-height: 1.45; color: ${BRAND.textSecondary}; }
      .alert-line { color: ${BRAND.warning}; }
      .center { text-align: center; }
      .amount-cell { white-space: nowrap; }
      .amount-positive { color: ${BRAND.success}; font-weight: 700; }
      .amount-negative { color: ${BRAND.danger}; font-weight: 700; }
      .footer {
        margin-top: 18px;
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
          <td class="logo-cell">${logoHtml}</td>
          <td class="header-text">
            <h1>${appName}</h1>
            <p>${escapeHtml(t('adminBackupTitle'))}</p>
            <p>${escapeHtml(t('adminBackupExportedAt'))}: ${escapeHtml(exportDate)}</p>
            <p>${escapeHtml(t('adminBackupExportedBy'))}: ${escapeHtml(snapshot.exportedByName)}${snapshot.exportedByEmail ? ` (${escapeHtml(snapshot.exportedByEmail)})` : ''}</p>
            <p>${escapeHtml(t('adminBackupAppVersion'))}: ${escapeHtml(snapshot.appVersion)}</p>
            <span class="badge-backup">${escapeHtml(t('adminBackupSubtitle'))}</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('adminBackupSummary'))}</h2>
      ${summaryStats}
    </div>

    <div class="section">
      <h2>${escapeHtml(t('adminBackupUsersSection'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('accountName'))}</th>
            <th>${escapeHtml(t('role'))}</th>
            <th>${escapeHtml(t('email'))}</th>
            <th>${escapeHtml(t('adminBackupBalance'))}</th>
            <th>${escapeHtml(t('adminBackupCreatedAt'))}</th>
            <th>${escapeHtml(t('adminBackupPermissions'))}</th>
            <th>${escapeHtml(t('adminBackupFinanceCards'))}</th>
          </tr>
        </thead>
        <tbody>${userRows || `<tr><td colspan="7">${escapeHtml(t('adminBackupNoData'))}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('adminBackupSettingsSection'))}</h2>
      ${settingsBlock}
      <h3 class="subsection">${escapeHtml(t('adminBackupOrdersHomeCards'))}</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${escapeHtml(t('adminBackupType'))}</th>
            <th>${escapeHtml(t('adminBackupName'))}</th>
            <th>${escapeHtml(t('adminBackupDescription'))}</th>
          </tr>
        </thead>
        <tbody>${homeCardRows || `<tr><td colspan="4">${escapeHtml(t('adminBackupNoData'))}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('adminBackupTransactionsSection'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('exportDate'))}</th>
            <th>${escapeHtml(t('accountName'))}</th>
            <th>${escapeHtml(t('transactionType'))}</th>
            <th>${escapeHtml(t('amount'))}</th>
            <th>${escapeHtml(t('notes'))}</th>
          </tr>
        </thead>
        <tbody>${transactionRows || `<tr><td colspan="5">${escapeHtml(t('adminBackupNoData'))}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('adminBackupOrdersSection'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('adminBackupInvoice'))}</th>
            <th>${escapeHtml(t('exportDate'))}</th>
            <th>${escapeHtml(t('customerName'))}</th>
            <th>${escapeHtml(t('phoneNumber'))}</th>
            <th>${escapeHtml(t('adminBackupOrderSection'))}</th>
            <th>${escapeHtml(t('adminBackupTotal'))}</th>
            <th>${escapeHtml(t('collectedAmount'))}</th>
            <th>${escapeHtml(t('adminBackupRemaining'))}</th>
            <th>${escapeHtml(t('adminBackupConfirmedBy'))}</th>
          </tr>
        </thead>
        <tbody>${orderRows || `<tr><td colspan="9">${escapeHtml(t('adminBackupNoData'))}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('adminBackupAttendanceSection'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('exportDate'))}</th>
            <th>${escapeHtml(t('accountName'))}</th>
            <th>${escapeHtml(t('adminBackupAttendanceType'))}</th>
            <th>${escapeHtml(t('notes'))}</th>
          </tr>
        </thead>
        <tbody>${attendanceRows || `<tr><td colspan="4">${escapeHtml(t('adminBackupNoData'))}</td></tr>`}</tbody>
      </table>
    </div>

    <div class="footer">${escapeHtml(t('adminBackupFooter'))} · ${CURRENCY}</div>
  </body>
</html>`;
}

function buildTransactionRow(
  tx: Transaction,
  userMap: Map<string, AppUser>,
  index: number,
  t: TFunction,
): string {
  const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
  const user = userMap.get(tx.userId);
  const typeLabel = getTransactionTypeLabel(tx.type, t);
  return `
    <tr class="${rowClass}">
      <td>${escapeHtml(formatDateTime(tx.createdAt))}</td>
      <td>${escapeHtml(user?.name ?? tx.userId)}</td>
      <td>${escapeHtml(typeLabel)}</td>
      <td class="amount-cell">${amountCell(tx.amount)}</td>
      <td>${escapeHtml(tx.note || '—')}</td>
    </tr>
  `;
}

export async function exportAdminBackupReport(
  snapshot: AdminBackupSnapshot,
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildAdminBackupHtml(snapshot, t, logoDataUri, options);

  let result: Print.FilePrintResult;
  try {
    result = await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
      base64: true,
    });
  } catch (error) {
    console.error('[exportAdminBackupReport] printToFileAsync failed', error);
    throw new Error('PDF generation failed');
  }

  try {
    const shareUri = await prepareShareablePdf(result, 'business-backup');
    await sharePdfFile(shareUri, t('adminBackupShareTitle'));
  } catch (error) {
    console.error('[exportAdminBackupReport] share failed', error);
    throw new Error('Could not open share dialog');
  }
}
