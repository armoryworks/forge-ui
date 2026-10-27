import { WbsElementType } from './wbs-element-type.model';

export interface CreateWbsElementRequest {
  parentElementId: number | null;
  code: string;
  name: string;
  type: WbsElementType;
  budgetLabor: number;
  budgetMaterial: number;
  budgetOther: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  sortOrder: number;
}
