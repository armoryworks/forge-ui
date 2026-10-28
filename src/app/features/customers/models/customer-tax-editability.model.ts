/** S1 — whether the quote dialog may let the user edit the tax rate for a customer. */
export interface CustomerTaxEditability {
  canEditTax: boolean;
  reason: string | null;
  activeDocumentId: number | null;
  stateCode: string | null;
  expiresAt: string | null;
  /** False when no tax configuration applies to the customer: a typed rate is then ordinary tax entry, not an override. */
  rateDetermined: boolean;
}
