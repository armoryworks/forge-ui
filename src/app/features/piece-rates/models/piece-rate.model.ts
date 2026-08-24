/** One row of a piece-rate timeline. */
export interface PieceRate {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  operationId: number | null;
  ratePerPiece: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

/** A scope's (part, optional operation) current rate + full history. */
export interface PieceRateTimeline {
  partId: number;
  partNumber: string;
  partDescription: string | null;
  operationId: number | null;
  current: PieceRate | null;
  history: PieceRate[];
}

/** Pieces a worker completed on a date, at the rate in force that day. */
export interface PieceWorkEntry {
  id: number;
  userId: number;
  userName: string;
  partId: number;
  partNumber: string;
  operationId: number | null;
  workDate: string;
  quantity: number;
  rateSnapshot: number;
  earnings: number;
  notes: string | null;
}

/** One worker-week of the make-up check. */
export interface PieceRateComplianceRow {
  userId: number;
  userName: string;
  stateCode: string | null;
  minimumWage: number;
  hoursWorked: number;
  pieceEarnings: number;
  requiredFloor: number;
  makeupOwed: number;
  effectiveHourly: number;
}

/** The weekly minimum-wage make-up report. */
export interface PieceRateCompliance {
  weekStart: string;
  weekEnd: string;
  rows: PieceRateComplianceRow[];
  totalMakeupOwed: number;
}

/** A selectable worker (from the shared /users endpoint). */
export interface PieceRateUser {
  id: number;
  name: string;
}
