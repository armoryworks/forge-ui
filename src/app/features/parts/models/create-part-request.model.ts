import { PartType } from './part-type.type';

export interface CreatePartRequest {
  partNumber: string;
  description: string;
  revision?: string;
  partType: PartType;
  material?: string;
  moldToolRef?: string;
}
