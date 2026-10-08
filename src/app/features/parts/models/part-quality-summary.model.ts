export interface PartQualityInspection {
  id: number;
  status: string;
  templateName: string | null;
  jobNumber: string | null;
  lotNumber: string | null;
  inspectorName: string;
  createdAt: string;
  completedAt: string | null;
  passedCount: number;
  failedCount: number;
}

export interface PartQualityNcr {
  id: number;
  ncrNumber: string;
  type: string;
  status: string;
  lotNumber: string | null;
  detectedAt: string;
  description: string;
  affectedQuantity: number;
}

export interface PartQualityLot {
  id: number;
  lotNumber: string;
  onHandQuantity: number;
  heldQuantity: number;
  isOnHold: boolean;
  expirationDate: string | null;
  createdAt: string;
}

export interface PartQualityTemplate {
  id: number;
  name: string;
  isActive: boolean;
  isReceivingTemplate: boolean;
}

export interface PartQualitySummary {
  partId: number;
  recentInspections: PartQualityInspection[];
  openNcrs: PartQualityNcr[];
  lots: PartQualityLot[];
  inspectionTemplates: PartQualityTemplate[];
  spcCharacteristicCount: number;
}
