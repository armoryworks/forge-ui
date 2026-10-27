import { PickLineStatus } from './pick-line-status.model';

/** One line to pick. Mirrors PickLineResponseModel. */
export interface PickLine {
  id: number;
  waveId: number;
  waveNumber: string;
  shipmentLineId: number;
  shipmentNumber: string | null;
  partId: number;
  partNumber: string;
  partDescription: string;
  fromLocationName: string;
  binPath: string | null;
  lotNumber: string | null;
  requestedQuantity: number;
  pickedQuantity: number;
  status: PickLineStatus;
  sortOrder: number;
  pickedByUserId: number | null;
  pickedAt: string | null;
  shortNotes: string | null;
}
