import { CreatePaymentApplicationRequest } from './create-payment-application-request.model';

export interface ApplyPaymentRequest {
  applications: CreatePaymentApplicationRequest[];
}
