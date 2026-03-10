export interface CreateSalesOrderLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
