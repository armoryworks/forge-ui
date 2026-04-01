export interface LotTraceability {
  lotNumber: string;
  partNumber: string;
  partDescription: string | null;
  jobs: LotTraceJob[];
  productionRuns: LotTraceProductionRun[];
  purchaseOrders: LotTracePurchaseOrder[];
  binLocations: LotTraceBinLocation[];
  inspections: LotTraceInspection[];
}

export interface LotTraceJob {
  id: number;
  jobNumber: string;
  title: string;
}

export interface LotTraceProductionRun {
  id: number;
  runNumber: string;
  status: string;
}

export interface LotTracePurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
}

export interface LotTraceBinLocation {
  locationId: number;
  locationName: string;
  quantity: number;
}

export interface LotTraceInspection {
  id: number;
  status: string;
  inspectorName: string;
  createdAt: Date;
}
