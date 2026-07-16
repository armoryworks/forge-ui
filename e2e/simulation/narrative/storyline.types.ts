import type { OrderFate } from './outcome';

/**
 * The narrative stages an order storyline moves through. The driver advances a
 * storyline at most one stage per simulated week, toward the end-state its
 * pre-rolled fate dictates. Terminal stages: lead-lost, quote-rejected,
 * cancelled, complete.
 */
export type StorylineStage =
  | 'new'            // just spawned, not yet a lead in the app
  | 'lead'           // lead created
  | 'lead-lost'      // terminal — lead never converted
  | 'estimate'       // estimate raised
  | 'quote'          // quote created + sent
  | 'quote-rejected' // terminal — quote declined
  | 'accepted'       // quote accepted, customer exists
  | 'order'          // sales order created (draft)
  | 'confirmed'      // SO confirmed (jobs auto-created, payment schedule advancing)
  | 'production'     // jobs advancing through the board
  | 'fulfilment'     // shipments going out (partial/split per fate)
  | 'billing'        // invoices sent, payments applied
  | 'cancelled'      // terminal — cancelled (early or late-fee)
  | 'complete';      // terminal — delivered + billed

/** Ids of the app entities this storyline has spawned, for cross-week continuation. */
export interface StorylineRefs {
  leadId?: number;
  customerId?: number;
  quoteId?: number;
  salesOrderId?: number;
  jobIds?: number[];
  shipmentIds?: number[];
  invoiceIds?: number[];
  lotIds?: number[];
  rawLotIds?: number[];
}

export interface StorylineState {
  id: number;
  seed: number;
  fate: OrderFate;
  stage: StorylineStage;
  refs: StorylineRefs;
  companyName: string;
  createdWeek: number;
  lastAdvancedWeek: number;
}

export const TERMINAL_STAGES: ReadonlySet<StorylineStage> = new Set<StorylineStage>([
  'lead-lost', 'quote-rejected', 'cancelled', 'complete',
]);

export function isTerminal(s: StorylineState): boolean {
  return TERMINAL_STAGES.has(s.stage);
}
