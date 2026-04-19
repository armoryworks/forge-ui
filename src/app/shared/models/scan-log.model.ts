export interface ScanLogEntry {
  id: number;
  actionType: string;
  userName: string;
  partNumber: string | null;
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  relatedEntity: string | null;
  isReversed: boolean;
  createdAt: string;
}

export interface ScanDevice {
  id: number;
  deviceId: string;
  deviceName: string | null;
  pairedAt: string;
  isActive: boolean;
}
