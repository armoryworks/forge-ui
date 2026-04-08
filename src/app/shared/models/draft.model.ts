export interface Draft {
  /** Composite key: "{userId}:{entityType}:{entityId|'new'}" */
  key: string;
  userId: number;
  entityType: string;
  entityId: string;
  displayLabel: string;
  route: string;
  formData: Record<string, unknown>;
  lastModified: number;
}
