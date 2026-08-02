import {Asset} from 'expo-asset';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {AppUser, Transaction, TransactionType} from '@app/types/models';
import {CURRENCY, formatCurrency} from '@app/utils/format';
import {buildFinanceReportData} from '@app/utils/financeReportData';
import {getTransactionTypeLabel} from '@app/utils/transactionLabels';
import {computeFinanceTotals, resolveAccountBalance} from '@app/utils/financeTotals';

const LOGO = require('../../assets/android-icon-foreground.png');

const BRAND = {
  primary: '#6C4DFF',
  primaryDark: '#5738F5',
  success: '#16A34A',
  successBg: '#DCFCE7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  info: '#2563EB',
  infoBg: '#DBEAFE',
  text: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  surface: '#F8FAFC',
};

interface ExportOptions {
  isRtl?: boolean;
  appName?: string;
  accountTitle?: string;
  startDate?: string;
  endDate?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function typeBadge(type: TransactionType, label: string): string {
  if (type === 'received' || type === 'ledger_credit' || type === 'advance_repayment') {
    return `<span class="badge badge-success">${escapeHtml(label)}</span>`;
  }
  if (type === 'paid' || type === 'ledger_debit' || type === 'advance') {
    return `<span class="badge badge-danger">${escapeHtml(label)}</span>`;
  }
  return `<span class="badge badge-warning">${escapeHtml(label)}</span>`;
}

function highlightCard(
  label: string,
  value: string,
  variant: 'received' | 'paid' | 'net' | 'balance',
): string {
  return `
    <div class="highlight-card highlight-${variant}">
      <div class="highlight-label">${escapeHtml(label)}</div>
      <div class="highlight-value">${value}</div>
    </div>
  `;
}

function formatReportPeriod(options: ExportOptions, t: TFunction): string {
  if (options.startDate && options.endDate) {
    return `${dayjs(options.startDate).format('YYYY-MM-DD')} — ${dayjs(options.endDate).format('YYYY-MM-DD')}`;
  }
  return t('financeExportAllTime');
}

function amountCell(amount: number): string {
  const className = amount >= 0 ? 'amount-positive' : 'amount-negative';
  return `<span class="${className}">${escapeHtml(formatCurrency(amount))}</span>`;
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

  try {
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('[exportFinanceReport] shareAsync failed', error);
    throw new Error('Could not open share dialog');
  }
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
    console.warn('[exportFinanceReport] logo load failed', error);
    return '';
  }
}

function buildFinanceReportHtml(
  users: AppUser[],
  transactions: Transaction[],
  t: TFunction,
  logoDataUri: string,
  options: ExportOptions,
): string {
  const report = buildFinanceReportData(users, transactions);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const {summary, accounts} = report;
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const logoPadding = options.isRtl ? 'padding-left:16px;' : 'padding-right:16px;';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const exportDate = dayjs().format('YYYY-MM-DD HH:mm');
  const periodLabel = formatReportPeriod(options, t);

  const periodFlowSummary = `
    <h3 class="subsection-title">${escapeHtml(t('financeExportPeriodSummary'))}</h3>
    <div class="highlight-row highlight-row-3">
      ${highlightCard(
        t('financeExportPeriodReceived'),
        escapeHtml(formatCurrency(summary.periodReceived)),
        'received',
      )}
      ${highlightCard(
        t('financeExportPeriodPaid'),
        escapeHtml(formatCurrency(summary.periodPaid)),
        'paid',
      )}
      ${highlightCard(
        t('financeExportPeriodNet'),
        escapeHtml(formatCurrency(summary.periodNet)),
        'net',
      )}
    </div>
  `;

  const secondaryStats = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('exportTotalTransactions'))}</div>
        <div class="stat-value">${summary.transactionCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('financeExportAccountCount'))}</div>
        <div class="stat-value">${summary.accountCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('financeExportCurrentTotalBalance'))}</div>
        <div class="stat-value">${escapeHtml(formatCurrency(summary.currentTotalBalance))}</div>
      </div>
    </div>
  `;

  const accountPeriodRows = accounts
    .map((account, index) => {
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(account.name)}</td>
          <td>${escapeHtml(account.role === 'admin' ? t('adminRole') : t('employeeRole'))}</td>
          <td class="center">${account.periodTransactionCount}</td>
          <td class="amount-cell amount-received">${amountCell(account.periodReceived)}</td>
          <td class="amount-cell amount-paid">${amountCell(-account.periodPaid)}</td>
          <td class="amount-cell amount-net">${amountCell(account.periodNet)}</td>
          <td class="amount-cell">${amountCell(account.currentBalance)}</td>
        </tr>
      `;
    })
    .join('');

  const transactionRows = report.transactions
    .map((tx, index) => {
      const user = userMap.get(tx.userId);
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      const typeLabel = getTransactionTypeLabel(tx.type, t);
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(dayjs(tx.createdAt).format('YYYY-MM-DD'))}<br/><span class="muted">${escapeHtml(dayjs(tx.createdAt).format('hh:mm A'))}</span></td>
          <td>${escapeHtml(user?.name ?? tx.userId)}</td>
          <td>${typeBadge(tx.type, typeLabel)}</td>
          <td class="amount-cell ${tx.amount >= 0 ? 'amount-received' : 'amount-paid'}">${amountCell(tx.amount)}</td>
          <td>${escapeHtml(tx.note || '—')}</td>
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
      .header-table {
        width: 100%;
        border-collapse: collapse;
      }
      .header-table td {
        vertical-align: middle;
      }
      .logo-cell {
        width: 88px;
        ${logoPadding}
      }
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
      }
      .subsection-title {
        font-size: 12px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
        margin: 0 0 8px;
      }
      .highlight-row {
        display: grid;
        gap: 8px;
        margin-bottom: 14px;
      }
      .highlight-row-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .highlight-card {
        border-radius: 10px;
        padding: 12px;
        border: 2px solid ${BRAND.border};
        text-align: center;
      }
      .highlight-received { background: #F0FDF4; border-color: #86EFAC; }
      .highlight-paid { background: #FEF2F2; border-color: #FCA5A5; }
      .highlight-net { background: #EFF6FF; border-color: #93C5FD; }
      .highlight-balance { background: ${BRAND.surface}; border-color: ${BRAND.border}; }
      .highlight-label {
        font-size: 11px;
        font-weight: 700;
        color: ${BRAND.textSecondary};
        margin-bottom: 6px;
      }
      .highlight-value {
        font-size: 17px;
        font-weight: 800;
        color: ${BRAND.primaryDark};
      }
      .highlight-received .highlight-value { color: ${BRAND.success}; }
      .highlight-paid .highlight-value { color: ${BRAND.danger}; }
      .highlight-net .highlight-value { color: #1D4ED8; }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .stat-card {
        background: ${BRAND.surface};
        border: 1px solid ${BRAND.border};
        border-radius: 10px;
        padding: 12px;
      }
      .stat-label {
        font-size: 11px;
        color: ${BRAND.textSecondary};
        margin-bottom: 4px;
      }
      .stat-value {
        font-size: 15px;
        font-weight: 700;
        color: ${BRAND.primaryDark};
      }
      h2 {
        font-size: 15px;
        margin: 0 0 12px;
        color: ${BRAND.primaryDark};
      }
      .section-hint {
        font-size: 10px;
        color: ${BRAND.textSecondary};
        margin: -6px 0 10px;
      }
      .section {
        margin-bottom: 24px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid ${BRAND.border};
        font-size: 11px;
      }
      thead th {
        background: ${BRAND.primary};
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
      .row-even { background: #fff; }
      .row-odd { background: ${BRAND.surface}; }
      .amount-cell { white-space: nowrap; font-weight: 700; }
      .amount-positive { color: ${BRAND.success}; }
      .amount-negative { color: ${BRAND.danger}; }
      .amount-received .amount-positive { color: ${BRAND.success}; }
      .amount-paid .amount-negative { color: ${BRAND.danger}; }
      .amount-net .amount-positive { color: #1D4ED8; }
      .center { text-align: center; }
      .badge {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
      }
      .badge-success { background: ${BRAND.successBg}; color: ${BRAND.success}; }
      .badge-danger { background: ${BRAND.dangerBg}; color: ${BRAND.danger}; }
      .badge-warning { background: ${BRAND.warningBg}; color: ${BRAND.warning}; }
      .badge-info { background: ${BRAND.infoBg}; color: ${BRAND.info}; }
      .muted { color: ${BRAND.textSecondary}; font-size: 10px; }
      .footer {
        margin-top: 16px;
        padding-top: 10px;
        border-top: 1px solid ${BRAND.border};
        font-size: 10px;
        color: ${BRAND.textSecondary};
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <table class="header-table">
        <tr>
          ${logoDataUri ? `<td class="logo-cell">${logoHtml}</td>` : ''}
          <td>
            <div class="header-text">
              <h1>${appName}</h1>
              <p>${escapeHtml(t('financeExportTitle'))}</p>
              <p>${escapeHtml(t('financeExportDateRange'))}: ${escapeHtml(periodLabel)}</p>
              <p>${escapeHtml(t('financeExportGeneratedAt'))}: ${escapeHtml(exportDate)}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('financeExportOverview'))}</h2>
      ${periodFlowSummary}
      ${secondaryStats}
    </div>

    <div class="section">
      <h2>${escapeHtml(t('financeExportByAccount'))}</h2>
      <p class="section-hint">${escapeHtml(t('financeExportByAccountHint'))}</p>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('accountName'))}</th>
            <th>${escapeHtml(t('role'))}</th>
            <th>${escapeHtml(t('financeExportPeriodTransactions'))}</th>
            <th>${escapeHtml(t('financeExportPeriodReceived'))}</th>
            <th>${escapeHtml(t('financeExportPeriodPaid'))}</th>
            <th>${escapeHtml(t('financeExportPeriodNet'))}</th>
            <th>${escapeHtml(t('financeExportCurrentBalance'))}</th>
          </tr>
        </thead>
        <tbody>${accountPeriodRows || `<tr><td colspan="7">—</td></tr>`}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('financeExportTransactionLog'))}</h2>
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
        <tbody>${transactionRows}</tbody>
      </table>
    </div>

    <div class="footer">${escapeHtml(t('financeExportFooter'))} · ${CURRENCY}</div>
  </body>
</html>`;
}

function buildEmployeeAccountReportHtml(
  user: AppUser,
  transactions: Transaction[],
  t: TFunction,
  logoDataUri: string,
  options: ExportOptions,
): string {
  const sortedTransactions = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const balance = resolveAccountBalance(user.balance, transactions);
  const {cashIn: receivedTotal, cashOut: paidTotal} = computeFinanceTotals(transactions);
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const logoPadding = options.isRtl ? 'padding-left:16px;' : 'padding-right:16px;';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const exportDate = dayjs().format('YYYY-MM-DD HH:mm');
  const roleLabel = user.role === 'admin' ? t('adminRole') : t('employeeRole');

  const transactionRows = sortedTransactions.length
    ? sortedTransactions
        .map((tx, index) => {
          const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
          return `
        <tr class="${rowClass}">
          <td>${escapeHtml(dayjs(tx.createdAt).format('YYYY-MM-DD'))}<br/><span class="muted">${escapeHtml(dayjs(tx.createdAt).format('hh:mm A'))}</span></td>
          <td>${typeBadge(tx.type, getTransactionTypeLabel(tx.type, t))}</td>
          <td class="amount-cell">${amountCell(tx.amount)}</td>
          <td>${escapeHtml(tx.note || '—')}</td>
        </tr>
      `;
        })
        .join('')
    : `<tr><td colspan="4" class="muted">${escapeHtml(t('noTransactions'))}</td></tr>`;

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="${appName}" class="logo" />`
    : '';

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
      .logo { width: 72px; height: 72px; border-radius: 12px; background: #fff; }
      .header-text h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
      .header-text p { margin: 0 0 2px; font-size: 12px; }
      .stats-table { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 20px; }
      .stats-table td { width: 25%; vertical-align: top; }
      .stat-card { background: ${BRAND.surface}; border: 1px solid ${BRAND.border}; border-radius: 10px; padding: 12px; }
      .stat-label { font-size: 11px; color: ${BRAND.textSecondary}; margin-bottom: 4px; }
      .stat-value { font-size: 16px; font-weight: 700; color: ${BRAND.primaryDark}; }
      .stat-value.success { color: ${BRAND.success}; }
      .stat-value.danger { color: ${BRAND.danger}; }
      h2 { font-size: 15px; margin: 0 0 10px; color: ${BRAND.primaryDark}; }
      .section { margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; border: 1px solid ${BRAND.border}; font-size: 11px; }
      thead th { background: ${BRAND.primary}; color: #fff; font-weight: 700; padding: 8px 6px; text-align: ${align}; }
      tbody td { padding: 8px 6px; border-top: 1px solid ${BRAND.border}; vertical-align: top; }
      .row-even { background: #fff; }
      .row-odd { background: ${BRAND.surface}; }
      .amount-cell { white-space: nowrap; font-weight: 700; }
      .amount-positive { color: ${BRAND.success}; }
      .amount-negative { color: ${BRAND.danger}; }
      .badge { display: inline-block; padding: 3px 7px; border-radius: 999px; font-size: 10px; font-weight: 700; }
      .badge-success { background: ${BRAND.successBg}; color: ${BRAND.success}; }
      .badge-danger { background: ${BRAND.dangerBg}; color: ${BRAND.danger}; }
      .badge-warning { background: ${BRAND.warningBg}; color: ${BRAND.warning}; }
      .muted { color: ${BRAND.textSecondary}; font-size: 10px; text-align: center; }
      .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid ${BRAND.border}; font-size: 10px; color: ${BRAND.textSecondary}; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header">
      <table class="header-table">
        <tr>
          ${logoDataUri ? `<td class="logo-cell">${logoHtml}</td>` : ''}
          <td>
            <div class="header-text">
              <h1>${escapeHtml(user.name)}</h1>
              <p>${escapeHtml(options.accountTitle ?? t('exportAccountStatementTitle'))}</p>
              <p>${escapeHtml(roleLabel)} · ${escapeHtml(t('exportDate'))}: ${escapeHtml(exportDate)}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <table class="stats-table">
      <tr>
        <td>
          <div class="stat-card">
            <div class="stat-label">${escapeHtml(t('currentBalance'))}</div>
            <div class="stat-value">${escapeHtml(formatCurrency(balance))}</div>
          </div>
        </td>
        <td>
          <div class="stat-card">
            <div class="stat-label">${escapeHtml(t('exportTotalTransactions'))}</div>
            <div class="stat-value">${sortedTransactions.length}</div>
          </div>
        </td>
        <td>
          <div class="stat-card">
            <div class="stat-label">${escapeHtml(t('exportTotalReceived'))}</div>
            <div class="stat-value success">${escapeHtml(formatCurrency(receivedTotal))}</div>
          </div>
        </td>
        <td>
          <div class="stat-card">
            <div class="stat-label">${escapeHtml(t('exportTotalPaid'))}</div>
            <div class="stat-value danger">${escapeHtml(formatCurrency(paidTotal))}</div>
          </div>
        </td>
      </tr>
    </table>

    <div class="section">
      <h2>${escapeHtml(t('transactions'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('exportDate'))}</th>
            <th>${escapeHtml(t('transactionType'))}</th>
            <th>${escapeHtml(t('amount'))}</th>
            <th>${escapeHtml(t('notes'))}</th>
          </tr>
        </thead>
        <tbody>${transactionRows}</tbody>
      </table>
    </div>

    <div class="footer">${escapeHtml(t('financeExportFooter'))} · ${escapeHtml(appName)} · ${CURRENCY}</div>
  </body>
</html>`;
}

async function renderAndSharePdf(html: string, fileStem: string, dialogTitle: string): Promise<void> {
  let shareUri: string;
  try {
    const result = await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
      base64: true,
    });
    shareUri = await prepareShareablePdf(result, fileStem);
  } catch (error) {
    console.error('[exportFinanceReport] printToFileAsync failed', error);
    throw new Error('PDF generation failed');
  }

  await sharePdfFile(shareUri, dialogTitle);
}

export async function exportEmployeeAccountReport(
  user: AppUser,
  transactions: Transaction[],
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildEmployeeAccountReportHtml(user, transactions, t, logoDataUri, options);
  const safeName = user.name.replace(/[^\w\u0600-\u06FF-]+/g, '-').replace(/^-+|-+$/g, '') || 'account';
  await renderAndSharePdf(html, `account-${safeName}`, t('exportAccountStatement'));
}

export async function exportFinanceReport(
  users: AppUser[],
  transactions: Transaction[],
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildFinanceReportHtml(users, transactions, t, logoDataUri, options);
  await renderAndSharePdf(html, 'finance', t('exportFinance'));
}
