/**
 * QB-001 mapping-editor row — a postable GL account joined with its QuickBooks
 * Online mapping (`qboAccountId` null = unmapped; the push refuses while an
 * unmapped account has activity).
 */
export interface QboAccountMapping {
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  qboAccountId: string | null;
  qboAccountName: string | null;
}
