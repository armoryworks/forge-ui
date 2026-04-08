export interface DraftConfig {
  entityType: string;
  entityId: string;
  displayLabel?: string;
  route: string;
  /** Custom snapshot function for forms with non-standard state (e.g., line items). */
  snapshotFn?: () => Record<string, unknown>;
  /** Custom restore function for forms with non-standard state (e.g., line items). */
  restoreFn?: (data: Record<string, unknown>) => void;
}
