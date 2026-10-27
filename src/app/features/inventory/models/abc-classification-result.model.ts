import { AbcClass } from '../../parts/models/abc-class.type';

export interface AbcClassificationResult {
  partId: number;
  partNumber: string;
  partDescription: string;
  classification: AbcClass;
  currentClassification: AbcClass | null;
  annualUsageValue: number;
  annualDemandQuantity: number;
  unitCost: number;
  cumulativePercent: number;
  rank: number;
}
