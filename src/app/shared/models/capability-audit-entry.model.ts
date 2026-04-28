/**
 * Phase 4 Phase-E — UI mirror of the server's audit-log entry shape used by
 * the per-capability scoped audit endpoint (`GET /api/v1/capabilities/{id}/
 * audit-log`). Reuses the shape of the existing `audit_log_entries` table.
 */
export interface CapabilityAuditEntry {
  id: number;
  userId: number;
  userName: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}
