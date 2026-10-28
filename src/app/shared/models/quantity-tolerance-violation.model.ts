export interface QuantityToleranceViolation {
  kind: string;
  lineId: number;
  ordered: number;
  alreadyDone: number;
  requested: number;
  maxAccepted: number;
  overPercent: number;
  underPercent: number;
  canOverride: boolean;
}
