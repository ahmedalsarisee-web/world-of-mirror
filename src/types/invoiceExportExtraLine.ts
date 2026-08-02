import {roundMoney} from '@app/utils/format';

export interface InvoiceExportExtraLine {
  specification: string;
  unitPrice: number;
  quantity: number;
}

export interface InvoiceExportExtraLineDraft {
  id: string;
  specification: string;
  unitPrice: number;
  quantity: number;
}

export function createEmptyInvoiceExtraLineDraft(id: string): InvoiceExportExtraLineDraft {
  return {id, specification: '', unitPrice: 0, quantity: 1};
}

export function resolveInvoiceExtraLineTotal(line: InvoiceExportExtraLine): number {
  return roundMoney(line.unitPrice * line.quantity);
}

export function sumInvoiceExportExtraLines(lines: InvoiceExportExtraLine[] | undefined): number {
  if (!lines?.length) {
    return 0;
  }
  return roundMoney(lines.reduce((sum, line) => sum + resolveInvoiceExtraLineTotal(line), 0));
}

export function sumInvoiceExtraLineDrafts(drafts: InvoiceExportExtraLineDraft[]): number {
  return sumInvoiceExportExtraLines(normalizeInvoiceExportExtraLines(drafts));
}

export function normalizeInvoiceExportExtraLines(
  drafts: InvoiceExportExtraLineDraft[],
): InvoiceExportExtraLine[] {
  return drafts
    .map((entry) => ({
      specification: entry.specification.trim(),
      unitPrice: roundMoney(Math.max(0, entry.unitPrice)),
      quantity: Math.max(1, Math.round(entry.quantity)),
    }))
    .filter((entry) => entry.specification.length > 0 && entry.unitPrice > 0);
}

export function normalizeStoredInvoiceExportExtraLines(
  value: unknown,
): InvoiceExportExtraLine[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const lines = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const specification = String(record.specification ?? '').trim();
      const unitPrice = roundMoney(Math.max(0, Number(record.unitPrice ?? 0)));
      const quantity = Math.max(1, Math.round(Number(record.quantity ?? 1)));
      if (!specification || unitPrice <= 0) {
        return null;
      }
      return {specification, unitPrice, quantity};
    })
    .filter((entry): entry is InvoiceExportExtraLine => entry !== null);

  return lines.length > 0 ? lines : undefined;
}

export function invoiceExportExtraLinesToDrafts(
  lines: InvoiceExportExtraLine[] | undefined,
): InvoiceExportExtraLineDraft[] {
  if (!lines?.length) {
    return [createEmptyInvoiceExtraLineDraft(`extra-empty-${Date.now()}`)];
  }

  return lines.map((line, index) => ({
    id: `stored-extra-${index}`,
    specification: line.specification,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
  }));
}
