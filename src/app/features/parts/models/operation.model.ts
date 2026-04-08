export interface Operation {
  id: number;
  partId: number;
  stepNumber: number;
  title: string;
  instructions: string | null;
  workCenterId: number | null;
  workCenterName: string | null;
  estimatedMinutes: number | null;
  isQcCheckpoint: boolean;
  qcCriteria: string | null;
  referencedOperationId: number | null;
  referencedOperationTitle: string | null;
  materials: OperationMaterial[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationMaterial {
  id: number;
  operationId: number;
  bomEntryId: number;
  childPartNumber: string;
  childPartDescription: string;
  quantity: number;
  notes: string | null;
}
