/**
 * Phase 4 Phase-G — UI mirrors of the server's preset response models from
 * Features/Presets/Models/PresetResponseModels.cs.
 */

export interface PresetSummary {
  id: string;
  name: string;
  shortDescription: string;
  targetProfile: string;
  capabilityCount: number;
  isCustom: boolean;
  isActive: boolean;
  recommendedFor: string[];
}

export interface PresetCapabilityRow {
  code: string;
  name: string;
  area: string;
  description: string;
  inPreset: boolean;
  defaultOn: boolean;
}

export interface PresetCapabilityDelta {
  code: string;
  name: string;
  area: string;
  currentlyEnabled: boolean;
  willBeEnabled: boolean;
}

export interface PresetDetail {
  id: string;
  name: string;
  shortDescription: string;
  targetProfile: string;
  capabilityCount: number;
  isCustom: boolean;
  isActive: boolean;
  recommendedFor: string[];
  capabilities: PresetCapabilityRow[];
  deltaVsCatalogDefaults: PresetCapabilityRow[];
  deltaVsCurrentInstall: PresetCapabilityDelta[];
}

export interface PresetCompareCell {
  presetId: string;
  inPreset: boolean;
}

export interface PresetCompareCapabilityRow {
  code: string;
  name: string;
  area: string;
  defaultOn: boolean;
  cells: PresetCompareCell[];
  disagreement: boolean;
}

export interface PresetCompareResponse {
  presets: PresetSummary[];
  rows: PresetCompareCapabilityRow[];
}

export interface PresetApplyViolation {
  code: string;
  capability: string;
  message: string;
  missing?: string[];
  conflicts?: string[];
  dependents?: string[];
}

export interface PresetApplyPreview {
  presetId: string;
  presetName: string;
  isCustom: boolean;
  deltaCount: number;
  deltas: PresetCapabilityDelta[];
  valid: boolean;
  violations: PresetApplyViolation[];
}

export interface PresetApplyResult {
  presetId: string;
  presetName: string;
  isCustom: boolean;
  noOp: boolean;
  deltaCount: number;
  applied: PresetCapabilityDelta[];
}

export interface PresetCustomOverride {
  code: string;
  enabled: boolean;
}

export interface PresetCustomPreview {
  capabilityCount: number;
  capabilities: PresetCapabilityRow[];
  deltaVsCurrentInstall: PresetCapabilityDelta[];
  valid: boolean;
  violations: PresetApplyViolation[];
}
