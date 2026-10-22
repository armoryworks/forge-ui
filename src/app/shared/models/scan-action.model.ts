export interface ScanContext {
  partId: number;
  partNumber: string;
  description: string | null;
  currentStock: number;
  currentLocationName: string | null;
  currentLocationId: number | null;
  availableActions: ScanAvailableAction[];
  stockUomCode?: string | null;
}

export interface ScanAvailableAction {
  action: string;
  enabled: boolean;
  disabledReason: string | null;
  context: unknown;
}

export interface ScanMoveRequest {
  partId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
}

export interface ScanCountRequest {
  partId: number;
  locationId: number;
  actualCount: number;
}

export interface ScanReceiveRequest {
  partId: number;
  purchaseOrderLineId: number;
  quantity: number;
  toLocationId: number;
  lotNumber?: string;
}

export interface ScanIssueRequest {
  partId: number;
  jobId: number;
  quantity: number;
  fromLocationId: number;
}

export interface ScanReceiveContextLine {
  purchaseOrderLineId: number;
  poNumber: string;
  expectedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  lotTracked?: boolean;
}

export interface ScanIssueContextJob {
  jobId: number;
  jobNumber: string;
  title: string;
  requiredQuantity: number;
  issuedQuantity: number;
  remainingQuantity: number;
}
