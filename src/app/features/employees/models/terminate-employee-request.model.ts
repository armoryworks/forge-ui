export interface TerminateEmployeeRequest {
  terminationDate: string;
  reasonCode: string;
  notes: string | null;
  rehireEligible: boolean;
  finalPayRequired: boolean;
}
