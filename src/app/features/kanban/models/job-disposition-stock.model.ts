export interface JobDispositionStock {
  partId: number | null;
  hasSeveralParts: boolean;
  defaultBinId: number | null;
  receivedQuantity: number;
  recordedQuantity: number;
  hasOpenRuns: boolean;
}
