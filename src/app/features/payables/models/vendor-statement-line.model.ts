export interface VendorStatementLine {
  documentType: string;
  documentId: number;
  documentNumber: string;
  vendorReference: string | null;
  documentDate: string;
  dueDate: string | null;
  currencyId: number;
  currencyCode: string | null;
  originalAmount: number;
  openAmount: number;
}
