export interface AuditLogEntry {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: Date;
}
