export interface ScanDevice {
  id: number;
  deviceId: string;
  deviceName: string | null;
  pairedAt: string;
  isActive: boolean;
  assignedUserId: number | null;
  assignedUserName: string | null;
  pairedByName: string | null;
  lastSeenAt: string | null;
}
