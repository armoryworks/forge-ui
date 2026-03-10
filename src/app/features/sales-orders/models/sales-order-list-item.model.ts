export interface SalesOrderListItem {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  status: string;
  customerPO: string | null;
  lineCount: number;
  total: number;
  requestedDeliveryDate: string | null;
  createdAt: string;
}
