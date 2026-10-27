import { PhysicalInventoryVarianceLine } from './physical-inventory-variance-line.model';

export interface PhysicalInventoryVariance {
  physicalInventoryId: number;
  inventoryNumber: string;
  lines: PhysicalInventoryVarianceLine[];
  tagCount: number;
  varianceTagCount: number;
  shortageValue: number;
  overageValue: number;
  netVarianceValue: number;
}
