export interface JobMarginItem {
  jobNumber: string;
  title: string;
  customerName: string | null;
  revenue: number;
  laborCost: number;
  materialCost: number;
  expenseCost: number;
  totalCost: number;
  margin: number;
  marginPercentage: number;
}
