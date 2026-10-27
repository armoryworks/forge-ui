export interface FmeaItemRequest {
  processStep: string | null;
  function: string | null;
  failureMode: string;
  potentialEffect: string;
  severity: number;
  classification: string | null;
  potentialCause: string | null;
  occurrence: number;
  currentPreventionControls: string | null;
  currentDetectionControls: string | null;
  detection: number;
  recommendedAction: string | null;
  targetCompletionDate: string | null;
}
