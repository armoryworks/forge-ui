/** GET /api/v1/invoices/{id}/email-recipient — who the invoice email goes to by default. */
export interface InvoiceEmailRecipient {
  email: string | null;
  source: 'billing-contact' | 'customer' | 'primary-contact' | null;
  contactName: string | null;
}
