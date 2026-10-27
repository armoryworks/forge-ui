export type MachineConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Error';

export interface MachineTag {
  id: number;
  tagName: string;
  opcNodeId: string;
  dataType: string;
  unit: string | null;
  warningThresholdLow: number | null;
  warningThresholdHigh: number | null;
  alarmThresholdLow: number | null;
  alarmThresholdHigh: number | null;
  isActive: boolean;
}

export interface MachineConnection {
  id: number;
  workCenterId: number;
  workCenterName: string;
  name: string;
  opcUaEndpoint: string;
  securityPolicy: string | null;
  authType: string | null;
  status: MachineConnectionStatus;
  lastConnectedAt: string | null;
  lastError: string | null;
  pollIntervalMs: number;
  isActive: boolean;
  tagCount: number;
  credentialsConfigured: boolean;
  lastDataPointAt: string | null;
  tags: MachineTag[];
}

export interface SaveMachineTagRequest {
  tagName: string;
  opcNodeId: string;
  dataType: string;
  unit: string | null;
  warningThresholdLow: number | null;
  warningThresholdHigh: number | null;
  alarmThresholdLow: number | null;
  alarmThresholdHigh: number | null;
}

export interface SaveMachineConnectionRequest {
  workCenterId: number;
  name: string;
  opcUaEndpoint: string;
  securityPolicy: string | null;
  authType: string | null;
  credentials: string | null;
  pollIntervalMs: number;
  isActive: boolean;
  tags: SaveMachineTagRequest[];
}

export interface MachineConnectionTestResult {
  success: boolean;
  errorMessage: string | null;
}

export interface WorkCenterOption {
  id: number;
  name: string;
  code: string;
}
