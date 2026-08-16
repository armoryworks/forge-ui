/**
 * A standing agreement already on file for the party — the "that over there" a
 * purchase order leans on. Party-scoped, so it carries no sales order.
 */
export interface PriorAgreement {
  id: number;
  statementType: string;
  method: string;
  capturedAt: string | null;
  sha256: string | null;
  filename: string | null;
  note: string | null;
}
