/**
 * Phase 4 Phase-E — UI mirror of the server's
 * `CapabilityRelationsResponseModel` (Features/Capabilities/Relations/
 * GetCapabilityRelations.cs). The capability detail page consumes this to
 * render the "Dependencies / Required by / Mutually exclusive" sections
 * without walking the full descriptor to compute the inverse graph.
 */
export interface CapabilityRelationEntry {
  code: string;
  name: string;
  area: string;
  enabled: boolean;
}

export interface CapabilityRelations {
  code: string;
  dependencies: CapabilityRelationEntry[];
  dependents: CapabilityRelationEntry[];
  mutexes: CapabilityRelationEntry[];
}
