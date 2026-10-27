/** The overhead pool as of a date, before closing it (`GET accounting/overhead/status`). */
export interface OverheadPoolStatus {
  asOf: string;
  actualOverhead: number;
  appliedOverhead: number;
  variance: number;
  closedOnDate: boolean;
  lastClosedOn: string | null;
  isConfigured: boolean;
}
