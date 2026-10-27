import { RecallAffectedLot } from './recall-affected-lot.model';
import { RecallAffectedShipment } from './recall-affected-shipment.model';

export interface RecallImpactPreview {
  initiatedLotId: number;
  initiatedLotNumber: string;
  affectedLotsCount: number;
  affectedShipmentsCount: number;
  affectedCustomersCount: number;
  totalQuarantineQuantity: number;
  affectedLots: RecallAffectedLot[];
  affectedShipments: RecallAffectedShipment[];
}
