import type {TransactionType} from '@app/types/models';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';

export interface FinanceNotificationMetadata {
  transactionId: string;
  accountUserId: string;
  accountName: string;
  actorUserId?: string;
  actorName: string;
  transactionType: TransactionType;
  typeLabel: string;
  amount: number;
  amountLabel: string;
  note: string;
  description: string;
  ledgerId?: string;
  ledgerName?: string;
  createdAt: string;
  /** When set, this notification is for an edit rather than a new transaction. */
  updatedAt?: string;
  /** When set, this notification is for a deleted transaction. */
  deletedAt?: string;
}

export interface AttendanceNotificationMetadata {
  recordId: string;
  employeeUserId: string;
  employeeName: string;
  type: 'check_in' | 'check_out';
  note: string;
  createdAt: string;
}

export interface ConfirmedOrderNotificationMetadata {
  orderId: string;
  customerName: string;
  total: number;
  totalLabel: string;
  invoiceLabel: string;
  confirmedAt: string;
  actorUserId?: string;
  actorName?: string;
  homeCardId?: string;
  status?: MirrorPricingOrderStatus;
  sectionLabel?: string;
}

export interface OrderMoveNotificationMetadata {
  orderId: string;
  moveEventId: string;
  employeeName: string;
  fromLabel: string;
  toLabel: string;
  invoiceLabel: string;
  movedAt: string;
  actorUserId?: string;
  toHomeCardId?: string;
  toStatus?: MirrorPricingOrderStatus;
}

export interface OrderUpdatedNotificationMetadata {
  orderId: string;
  updateEventId: string;
  customerName: string;
  total: number;
  totalLabel: string;
  invoiceLabel: string;
  updatedAt: string;
  actorUserId?: string;
  actorName: string;
  homeCardId?: string;
  status?: MirrorPricingOrderStatus;
  sectionLabel?: string;
}

export interface OrderDeletedNotificationMetadata {
  orderId: string;
  deleteEventId: string;
  actorUserId?: string;
  actorName: string;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  customerLocation: string;
  customerNotes?: string;
  orderCardNote?: string;
  invoiceNote?: string;
  invoiceLabel: string;
  statusLabel: string;
  pieceCount: number;
  total: number;
  totalLabel: string;
  collectedAmount: number;
  collectedLabel: string;
  remainingAmount: number;
  remainingLabel: string;
  deletedAt: string;
  homeCardId?: string;
  status?: MirrorPricingOrderStatus;
}

export interface MirrorWarehouseNotificationMetadata {
  operation: 'catalog_upload' | 'catalog_delete' | 'stock_adjust';
  imageId?: string;
  count?: number;
  delta?: number;
  newCount?: number;
  actorUserId?: string;
  actorName: string;
  eventAt: string;
}

export interface AdminNotificationMetadata {
  finance?: FinanceNotificationMetadata;
  attendance?: AttendanceNotificationMetadata;
  confirmedOrder?: ConfirmedOrderNotificationMetadata;
  orderMove?: OrderMoveNotificationMetadata;
  orderUpdated?: OrderUpdatedNotificationMetadata;
  orderDeleted?: OrderDeletedNotificationMetadata;
  mirrorWarehouse?: MirrorWarehouseNotificationMetadata;
}
