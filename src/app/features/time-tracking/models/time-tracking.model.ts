export interface TimeEntry {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  userId: number;
  userName: string;
  date: string;
  durationMinutes: number;
  category: string | null;
  notes: string | null;
  timerStart: string | null;
  timerStop: string | null;
  isManual: boolean;
  isLocked: boolean;
  createdAt: string;
}

export interface CreateTimeEntryRequest {
  jobId?: number;
  date: string;
  durationMinutes: number;
  category?: string;
  notes?: string;
}

export interface StartTimerRequest {
  jobId?: number;
  category?: string;
  notes?: string;
}

export interface StopTimerRequest {
  notes?: string;
}

export interface UpdateTimeEntryRequest {
  jobId?: number;
  date?: string;
  durationMinutes?: number;
  category?: string;
  notes?: string;
}

export interface ClockEvent {
  id: number;
  userId: number;
  userName: string;
  eventType: ClockEventType;
  reason: string | null;
  scanMethod: string | null;
  timestamp: string;
  source: string | null;
}

export interface CreateClockEventRequest {
  eventType: ClockEventType;
  reason?: string;
  scanMethod?: string;
  source?: string;
}

export type ClockEventType = 'ClockIn' | 'ClockOut';
