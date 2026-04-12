export interface ShiftAssignment {
  id: number;
  userId: number;
  userName: string;
  shiftId: number;
  shiftName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  shiftDifferentialRate: number | null;
  notes: string | null;
}

export interface CreateShiftAssignmentRequest {
  userId: number;
  shiftId: number;
  effectiveFrom: string;
  effectiveTo?: string;
  shiftDifferentialRate?: number;
  notes?: string;
}
