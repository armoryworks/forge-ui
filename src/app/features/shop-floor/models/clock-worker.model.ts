export interface WorkerAssignment {
  jobId: number;
  jobNumber: string;
  title: string;
  priorityName: string;
  stageName: string;
  stageColor: string;
  isOverdue: boolean;
  hasActiveTimer: boolean;
}

export interface ClockWorker {
  userId: number;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  isClockedIn: boolean;
  clockedInAt: Date | null;
  status: 'In' | 'OnBreak' | 'Out';
  currentTask: string | null;
  currentJobNumber: string | null;
  timeOnTask: string;
  statusSince: string | null;
  assignments: WorkerAssignment[];
}
