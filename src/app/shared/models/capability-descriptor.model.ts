/**
 * Phase 4 Phase-A — UI mirror of the server's
 * `CapabilityDescriptorResponseModel` shape (Features/Capabilities/Descriptor/
 * GetCapabilityDescriptor.cs). The UI consumes this once at login and on
 * SignalR `capability:changed` events (Phase C) to keep route guards,
 * structural directives, and nav suppression in sync with installation state.
 */

export interface CapabilityDescriptorEntry {
  id: string;
  code: string;
  area: string;
  name: string;
  description: string;
  enabled: boolean;
  isDefaultOn: boolean;
  requiresRoles: string | null;
  /** Phase 4 Phase-C — monotonic Version, used as the row's ETag value. */
  version: number;
  /** Phase 4 Phase-C — weak ETag (`W/"<version>"`) submitted as `If-Match` on writes. */
  eTag: string;
  /** Phase 4 Phase-C — separate version for the capability's config row, null if no row exists yet. */
  configVersion: number | null;
  configETag: string | null;
  configId: number | null;
  dependencies: string[];
  mutexes: string[];
}

export interface CapabilityDescriptor {
  generatedAt: string;
  totalCount: number;
  enabledCount: number;
  capabilities: CapabilityDescriptorEntry[];
}
