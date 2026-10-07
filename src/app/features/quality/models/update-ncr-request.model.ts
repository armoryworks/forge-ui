import { NcrType } from './ncr-type.model';

export interface UpdateNcrRequest {
  type?: NcrType;
  description?: string;
  affectedQuantity?: number;
  defectiveQuantity?: number;
  containmentActions?: string;
  materialCost?: number;
  laborCost?: number;
}
