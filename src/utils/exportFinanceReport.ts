import {Asset} from 'expo-asset';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {AppUser, Transaction, TransactionType} from '@app/types/models';
import {CURRENCY, formatCurrency} from '@app/utils/format';

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

function transactionTypeLabel(type: TransactionType, t: TFunction): string {
  if (type === 'received') {
    return t('received');
  }
  if (type === 'paid') {
    return t('paid');
  }
  return t('orderCollection');
}

function typeBadge(type: TransactionType, label: string): string {
  if (type === 'received') {
    return `<span class="badge badge-success">${escapeHtml(label)}</span>`;
  }
  if (type === 'paid') {
    return `<span class="badge badge-danger">${escapeHtml(label)}</span>`;
  }
  return `<span class="badge badge-warning">${escapeHtml(label)}</span>`;
}

function amountCell(amount: number): string {
  const className = amount >= 0 ? 'amount-positive' : 'amount-negative';
  return `<span class="${className}">${escapeHtml(formatCurrency(amount))}</span>`;
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
  const userMap = new Map(users.map((user) => [user.id, user]));
  const globalBalance = users.reduce((sum, user) => sum + user.balance, 0);
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
  const dir = options.isRtl ? 'rtl' : 'ltr';
  const align = options.isRtl ? 'right' : 'left';
  const logoPadding = options.isRtl ? 'padding-left:16px;' : 'padding-right:16px;';
  const appName = escapeHtml(options.appName ?? t('appName'));
  const exportDate = dayjs().format('YYYY-MM-DD HH:mm');
  const receivedTotal = transactions.filter((tx) => tx.amount >= 0).reduce((s, tx) => s + tx.amount, 0);
  const paidTotal = transactions.filter((tx) => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);

  const accountRows = sortedUsers
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.name)}</td>
          <td>${escapeHtml(user.role === 'admin' ? t('adminRole') : t('employeeRole'))}</td>
          <td class="amount-cell">${amountCell(user.balance)}</td>
        </tr>
      `,
    )
    .join('');

  const transactionRows = transactions
    .map((tx, index) => {
      const user = userMap.get(tx.userId);
      const rowClass = index % 2 === 0 ? 'row-even' : 'row-odd';
      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(dayjs(tx.createdAt).format('YYYY-MM-DD'))}<br/><span class="muted">${escapeHtml(dayjs(tx.createdAt).format('hh:mm A'))}</span></td>
          <td>${escapeHtml(user?.name ?? tx.userId)}</td>
          <td>${typeBadge(tx.type, transactionTypeLabel(tx.type, t))}</td>
          <td class="amount-cell">${amountCell(tx.amount)}</td>
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
      .stats-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 8px 0;
        margin-bottom: 20px;
      }
      .stats-table td {
        width: 25%;
        vertical-align: top;
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
        font-size: 16px;
        font-weight: 700;
        color: ${BRAND.primaryDark};
      }
      .stat-value.success { color: ${BRAND.success}; }
      .stat-value.danger { color: ${BRAND.danger}; }
      h2 {
        font-size: 15px;
        margin: 0 0 10px;
        color: ${BRAND.primaryDark};
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
              <p>${escapeHtml(t('exportDate'))}: ${escapeHtml(exportDate)}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <table class="stats-table">
      <tr>
        <td>
          <div class="stat-card">
            <div class="stat-label">${escapeHtml(t('globalCashBalance'))}</div>
            <div class="stat-value">${escapeHtml(formatCurrency(globalBalance))}</div>
          </div>
        </td>
        <td>
          <div class="stat-card">
            <div class="stat-label">${escapeHtml(t('exportTotalTransactions'))}</div>
            <div class="stat-value">${transactions.length}</div>
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
      <h2>${escapeHtml(t('exportAccountsSummary'))}</h2>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t('accountName'))}</th>
            <th>${escapeHtml(t('role'))}</th>
            <th>${escapeHtml(t('currentBalance'))}</th>
          </tr>
        </thead>
        <tbody>${accountRows}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>${escapeHtml(t('transactions'))}</h2>
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

export async function exportFinanceReport(
  users: AppUser[],
  transactions: Transaction[],
  t: TFunction,
  options: ExportOptions = {},
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildFinanceReportHtml(users, transactions, t, logoDataUri, options);

  let uri: string;
  try {
    const result = await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
    });
    uri = result.uri;
  } catch (error) {
    console.error('[exportFinanceReport] printToFileAsync failed', error);
    throw new Error('PDF generation failed');
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: t('exportFinance'),
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('[exportFinanceReport] shareAsync failed', error);
    throw new Error('Could not open share dialog');
  }
}
