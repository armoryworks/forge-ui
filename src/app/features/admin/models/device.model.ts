export interface EnrollmentToken {
  token: string;
  expiresAt: string;
  instanceName: string;
  certSha256: string | null;
  isShared: boolean;
}

export interface AdminDevice {
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
