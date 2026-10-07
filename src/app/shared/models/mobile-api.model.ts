import { ScanKind } from '../utils/scan-code';

export interface ScanResolveResult {
  kind: ScanKind;
  id: number | null;
  code: string;
  label: string;
  subtitle: string | null;
}

export interface JobActivityEntry {
  id: number;
  action: string;
  description: string;
  userInitials: string | null;
  userName: string | null;
  createdAt: string;
}

export interface JobStatus {
  id: number;
  jobNumber: string;
  title: string;
  customerName: string | null;
  stageId: number;
  stageName: string;
  stageColor: string;
  dueDate: string | null;
  isOverdue: boolean;
  nextStageId: number | null;
  nextStageName: string | null;
  nextStageIsShopFloor?: boolean;
  previousStageId: number | null;
  previousStageName: string | null;
  rowVersion: number;
  recentActivity: JobActivityEntry[];
}

export interface JobAdvanceResult {
  status: JobStatus;
  previousStageId: number;
  previousStageName: string;
  collapsed: boolean;
}

export interface JobNote {
  id: number;
  text: string;
  createdAt: string;
}

export interface UploadedJobFile {
  id: number;
  fileName: string;
}

export interface ClockState {
  state: 'out' | 'in' | 'break';
  lastEventType: string | null;
  lastEventAt: string | null;
  lastEventId: number | null;
}

export interface ClockPunchResult {
  eventId: number;
  state: ClockState;
}

export interface OnHand {
  partId: number;
  partNumber: string;
  locationId: number;
  locationName: string;
  quantity: number;
  lotTracked: boolean;
  lots: { lotNumber: string; quantity: number }[];
}

export interface StockMoveRequest {
  partId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  lotNumber: string | null;
}

export interface StockMoveResult {
  partNumber: string;
  fromLocationName: string;
  toLocationName: string;
  quantity: number;
  lotNumber: string | null;
  undo: StockMoveRequest;
}

export interface ActiveTimer {
  timeEntryId: number;
  jobId: number | null;
  jobNumber: string | null;
  operationId: number | null;
  timerStart: Date;
}

export interface StartedTimeEntry {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  timerStart: Date | null;
}

/**
 * `entryId` is null when the start was queued offline; `queuedIds` holds the
 * queue entries it made. `previous` is the timer a switch stopped, so undoing
 * the start can put it back.
 */
export interface TimerStartOutcome {
  entryId: number | null;
  queuedIds: string[];
  previous: ActiveTimer | null;
}

/** `queuedId` is set when the stop was queued offline rather than sent. */
export interface TimerStopOutcome {
  stopped: ActiveTimer | null;
  queuedId: string | null;
}

/** What a Start press did once the server's running timer was known: started, or found the timer already on that job and left it alone. */
export type TimerToggleOutcome = { started: TimerStartOutcome } | { alreadyRunning: ActiveTimer };

/** Returned in place of a result when the device is offline and the change was queued. */
export interface QueuedOffline {
  queued: true;
  entryId: string;
}

export function isQueued<T>(value: T | QueuedOffline): value is QueuedOffline {
  return typeof value === 'object' && value !== null && (value as QueuedOffline).queued === true;
}
