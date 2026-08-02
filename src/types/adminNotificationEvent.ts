import type {AdminNotificationKind} from '@app/stores/adminNotificationStore';
import type {AdminNotificationMetadata} from '@app/types/adminNotificationMetadata';

export interface AdminNotificationEvent {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  body: string;
  sourceId: string;
  eventAt: string;
  recordedAt: string;
  metadata?: AdminNotificationMetadata;
  actorUserId?: string;
  actorName?: string;
  accountUserId?: string;
  accountName?: string;
}

export interface PersistAdminNotificationEventInput {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  body: string;
  sourceId: string;
  eventAt?: number;
  metadata?: AdminNotificationMetadata;
  actorUserId?: string;
  actorName?: string;
  accountUserId?: string;
  accountName?: string;
}
