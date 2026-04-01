export interface ClockWorker {
  userId: number;
  name: string;
  initials: string;
  avatarColor: string;
  isClockedIn: boolean;
  clockedInAt: Date | null;
  status: 'In' | 'OnBreak' | 'Out';
  currentTask: string | null;
  currentJobNumber: string | null;
  timeOnTask: string;
}
