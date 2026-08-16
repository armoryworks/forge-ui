import { PriorAgreement } from './prior-agreement.model';

/**
 * What authorized a sales order. Null from the API when the order was keyed in
 * or converted from a quote — the absence is information, not an error.
 */
export interface SalesOrderAuthorization {
  attestationId: number;
  statementType: string;
  method: string;
  status: string;
  /** When the customer sent it — not when staff acted on it. This is what the line quotes. */
  capturedAt: string | null;
  fromAddress: string | null;
  channel: string | null;
  artifactId: number | null;
  filename: string | null;
  sha256: string | null;
  /** Route back to the original message. */
  communicationId: number | null;
  /** Standing agreements this leans on, nearest first. */
  authorizationChain: PriorAgreement[];
}
