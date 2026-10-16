export function isBillingStage(accountingDocumentType: string | null | undefined): boolean {
  return accountingDocumentType === 'Invoice' || accountingDocumentType === 'Payment';
}
