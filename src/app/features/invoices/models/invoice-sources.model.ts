import { InvoiceSourceSalesOrder } from './invoice-source-sales-order.model';
import { InvoiceSourceShipment } from './invoice-source-shipment.model';

export interface InvoiceSources {
  salesOrders: InvoiceSourceSalesOrder[];
  shipments: InvoiceSourceShipment[];
}
