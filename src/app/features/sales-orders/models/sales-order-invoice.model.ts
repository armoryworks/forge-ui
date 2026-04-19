export interface SalesOrderInvoice {
  id: number;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueDate: string | null;
  paymentStatus: string;
  shipmentNumbers: string[];
}
