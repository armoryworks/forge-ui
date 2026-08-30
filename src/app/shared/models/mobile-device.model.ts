export interface MobileDevice {
  id: number;
  userId: number | null;
  userName: string | null;
  name: string;
  platform: string;
  osVersion: string | null;
  appVersion: string | null;
  enrolledAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  isFlagged: boolean;
  isStale: boolean;
}
