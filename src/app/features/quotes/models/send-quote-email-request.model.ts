/** Payload for POST /api/v1/quotes/{id}/send-email. */
export interface SendQuoteEmailRequest {
  recipientEmail: string;
  message?: string;
}
