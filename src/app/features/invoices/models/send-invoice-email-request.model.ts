/** Payload for POST /api/v1/invoices/{id}/email. */
export interface SendInvoiceEmailRequest {
  recipientEmail: string;
}
