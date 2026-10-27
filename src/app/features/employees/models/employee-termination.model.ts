export interface EmployeeTermination {
  terminationDate: string;
  reasonCode: string;
  notes?: string | null;
  rehireEligible: boolean;
  finalPayRequired: boolean;
  finalPayProcessedAt?: string | null;
  appliedAt?: string | null;
  terminatedByUserId?: number | null;
}
