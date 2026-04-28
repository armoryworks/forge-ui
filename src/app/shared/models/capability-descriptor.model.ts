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
}

export interface CapabilityDescriptor {
  generatedAt: string;
  totalCount: number;
  enabledCount: number;
  capabilities: CapabilityDescriptorEntry[];
}
