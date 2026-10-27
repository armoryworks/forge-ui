export interface WbsElementSummary {
  id: number;
  parentElementId: number | null;
  code: string;
  name: string;
  type: string;
  budgetTotal: number;
  actualTotal: number;
  variance: number;
  percentComplete: number | null;
  children: WbsElementSummary[];
}
