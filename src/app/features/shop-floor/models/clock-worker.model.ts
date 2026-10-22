import { KioskNextOperation } from './kiosk-available-job.model';
import { KioskRunningTimer } from './kiosk-running-timer.model';

export interface WorkerAssignment {
  jobId: number;
  jobNumber: string;
  title: string;
  priorityName: string;
  stageName: string;
  stageColor: string;
  isOverdue: boolean;
  hasActiveTimer: boolean;
  timerStartedAt?: string | null;
  partNumber?: string | null;
  nextOperation?: KioskNextOperation | null;
  dueDate?: string | null;
  isAssigned?: boolean;
  isRecent?: boolean;
}

export interface ClockWorker {
  userId: number;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  isClockedIn: boolean;
  clockedInAt: Date | null;
  status: string;
  currentTask: string | null;
  currentJobNumber: string | null;
  timeOnTask: string;
  statusSince: string | null;
  assignments: WorkerAssignment[];
  role: string;
  openFromPriorShift?: boolean;
  openSince?: string | null;
  runningTimers?: KioskRunningTimer[];
}
