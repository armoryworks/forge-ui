import { InterPlantTransferLine } from './inter-plant-transfer-line.model';
import { InterPlantTransferStatus } from './inter-plant-transfer-status.type';

export interface InterPlantTransfer {
  id: number;
  transferNumber: string;
  fromPlantId: number;
  fromPlantName: string;
  toPlantId: number;
  toPlantName: string;
  status: InterPlantTransferStatus;
  shippedAt: string | null;
  receivedAt: string | null;
  trackingNumber: string | null;
  notes: string | null;
  lineCount: number;
  lines: InterPlantTransferLine[];
  createdAt: string;
  updatedAt: string;
}
