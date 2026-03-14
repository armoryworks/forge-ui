export type PayrollDocumentSource = 'Accounting' | 'Manual';
export type TaxDocumentType = 'W2' | 'W2c' | 'Misc1099' | 'Nec1099' | 'Other';

export interface PayStub {
  id: number;
  userId: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
  totalTaxes: number;
  fileAttachmentId: number | null;
  source: PayrollDocumentSource;
  externalId: string | null;
  deductions: PayStubDeduction[];
}

export interface PayStubDeduction {
  id: number;
  category: string;
  description: string;
  amount: number;
}

export interface TaxDocument {
  id: number;
  userId: number;
  documentType: TaxDocumentType;
  taxYear: number;
  employerName: string | null;
  fileAttachmentId: number | null;
  source: PayrollDocumentSource;
  externalId: string | null;
}
