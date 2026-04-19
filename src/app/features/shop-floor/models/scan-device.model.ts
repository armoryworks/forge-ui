export interface ScanDevice {
  id: number;
  deviceId: string;
  userId: number;
  userName: string;
  userInitials: string;
  userColor: string;
  isActive: boolean;
  lastActivity: string | null;
  pairedAt: string;
}

export interface ScanActivityItem {
  id: number;
  deviceId: string;
  userId: number;
  userInitials: string;
  userColor: string;
  userName: string;
  actionType: ScanActionType;
  partNumber: string | null;
  jobNumber: string | null;
  timestamp: string;
}

export type ScanActionType = 'Move' | 'Receive' | 'Ship' | 'Inspect' | 'Clock' | 'Identify' | 'Other';

export type ScanFeedbackState = 'idle' | 'success' | 'error' | 'needs-input';
