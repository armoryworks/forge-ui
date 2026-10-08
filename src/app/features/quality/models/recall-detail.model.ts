import { Recall } from './recall.model';
import { RecallAffectedLot } from './recall-affected-lot.model';
import { RecallAffectedShipment } from './recall-affected-shipment.model';

export interface RecallDetail extends Recall {
  resolutionNotes: string | null;
  affectedLots: RecallAffectedLot[];
  affectedShipments: RecallAffectedShipment[];
}
