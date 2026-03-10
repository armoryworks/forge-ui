import { CreatePaymentApplicationRequest } from './create-payment-application-request.model';

export interface CreatePaymentRequest {
  customerId: number;
  method: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  applications: CreatePaymentApplicationRequest[];
}
