export interface ClockWorker {
  userId: number;
  name: string;
  initials: string;
  avatarColor: string;
  isClockedIn: boolean;
  clockedInAt: string | null;
}
