/**
 * Phase 4 Phase-F — UI mirror of the server's
 * `DiscoveryRecommendationResponseModel` from
 * Features/Discovery/Preview/PreviewDiscoveryRecommendation.cs.
 */

export interface DiscoveryRecommendationFactor {
  questionId: string;
  description: string;
}

export interface DiscoveryAlternative {
  presetId: string;
  presetName: string;
  distinguishingRationale: string;
}

export interface CapabilityDelta {
  code: string;
  name: string;
  currentlyEnabled: boolean;
  willBeEnabled: boolean;
}

export interface DiscoveryRecommendation {
  presetId: string;
  presetName: string;
  presetDescription: string;
  confidence: number;
  /** "high" | "medium" | "low". */
  confidenceLabel: string;
  rationale: string;
  factors: DiscoveryRecommendationFactor[];
  alternatives: DiscoveryAlternative[];
  capabilityDeltas: CapabilityDelta[];
}

export interface DiscoveryAnswer {
  questionId: string;
  value: string;
}
