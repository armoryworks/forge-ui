import { TaxCollectedBy } from './sales-channel.model';

/** Consumer identity on a retail order. Matched to an existing buyer on (channel, externalBuyerId). */
export interface RetailBuyerInput {
  /** Blank for a walk-in — the server mints a synthetic id so each one stays a distinct buyer. */
  externalBuyerId: string | null;
  displayName: string;
  contactEmail: string | null;
  phone: string | null;
  marketingConsent: boolean;
}

/** Destination, snapshotted onto the order rather than stored in the customer address book. */
export interface OrderShipToInput {
  name: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isValidated: boolean;
}

export interface CreateRetailOrderLine {
  partId: number | null;
  externalSku: string | null;
  description: string;
  quantity: number;
  /** What the buyer actually paid. Never re-resolved from a price list. */
  unitPrice: number;
  notes: string | null;
}

/**
 * A consumer order. The same payload manual entry and channel importers both
 * send, so a hand-keyed order and an imported one are the same kind of thing.
 */
export interface CreateRetailOrderRequest {
  channelId: number | null;
  buyer: RetailBuyerInput;
  shipTo: OrderShipToInput;
  lines: CreateRetailOrderLine[];
  externalOrderNumber: string | null;
  externalOrderId: string | null;
  taxRate: number;
  taxCollectedBy: TaxCollectedBy | null;
  orderDate: string | null;
  notes: string | null;
  shippingAmount: number | null;
}
