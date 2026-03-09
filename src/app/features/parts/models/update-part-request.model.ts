import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';

export interface UpdatePartRequest {
  description?: string;
  revision?: string;
  status?: PartStatus;
  partType?: PartType;
  material?: string;
  moldToolRef?: string;
}
