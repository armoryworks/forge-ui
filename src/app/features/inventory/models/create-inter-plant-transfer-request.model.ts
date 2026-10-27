import { CreateInterPlantTransferLineRequest } from './create-inter-plant-transfer-line-request.model';

export interface CreateInterPlantTransferRequest {
  fromPlantId: number;
  toPlantId: number;
  notes: string | null;
  lines: CreateInterPlantTransferLineRequest[];
}
