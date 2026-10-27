import { SpcCharacteristic } from '../../quality/models/spc.model';

export interface SpcRecordDialogData {
  title: string;
  jobId: number;
  characteristics: SpcCharacteristic[];
}
