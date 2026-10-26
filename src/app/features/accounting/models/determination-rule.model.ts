/** One book-wide account-determination rule: the posting key, the account it resolves to, and whether the Controller may re-point it. */
export interface DeterminationRule {
  key: string;
  glAccountId: number | null;
  accountNumber: string | null;
  accountName: string | null;
  configurable: boolean;
  requiredAccountType: string | null;
}
