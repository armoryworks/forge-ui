/**
 * Phase 4 Phase-E — UI mirror of the server's
 * `ValidateCapabilityChangesResponseModel` (Features/Capabilities/Validate/
 * ValidateCapabilityChanges.cs). The validate-only endpoint returns the same
 * violation shape that the bulk-toggle 409 envelope carries, but without
 * persisting anything — useful for a "preview before commit" UX in admin.
 */
export interface CapabilityValidationViolation {
  code: string;
  capability: string;
  message: string;
  missing?: string[];
  conflicts?: string[];
  dependents?: string[];
}

export interface CapabilityValidationResult {
  valid: boolean;
  violations: CapabilityValidationViolation[];
}

export interface CapabilityValidationItem {
  id: string;
  enabled: boolean;
}
