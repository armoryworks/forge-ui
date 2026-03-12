export interface ClockWorker {
  userId: number;
  name: string;
  initials: string;
  avatarColor: string;
  isClockedIn: boolean;
  clockedInAt: string | null;
  status: 'In' | 'OnBreak' | 'Out';
  currentTask: string | null;
  currentJobNumber: string | null;
  timeOnTask: string;
}
