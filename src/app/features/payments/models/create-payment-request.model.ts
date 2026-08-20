import { CreatePaymentApplicationRequest } from './create-payment-application-request.model';

export interface CreatePaymentRequest {
  /** Optional manual override for the payment number (gated by tenant settings). */
  paymentNumber?: string;
  customerId: number;
  method: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  applications: CreatePaymentApplicationRequest[];
}
