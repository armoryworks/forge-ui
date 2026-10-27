import { ChannelReturnOrderLine } from './channel-return-order-line.model';

/** A sales-channel order a channel return can be recorded against. */
export interface ChannelReturnOrder {
  salesOrderId: number;
  orderNumber: string;
  externalOrderNumber: string | null;
  channelId: number;
  channelName: string;
  buyerName: string | null;
  customerName: string;
  createdAt: string;
  lines: ChannelReturnOrderLine[];
}
