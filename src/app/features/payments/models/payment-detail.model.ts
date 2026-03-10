import { PaymentApplication } from './payment-application.model';

export interface PaymentDetail {
  id: number;
  paymentNumber: string;
  customerId: number;
  customerName: string;
  method: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  paymentDate: string;
  referenceNumber: string | null;
  notes: string | null;
  applications: PaymentApplication[];
  createdAt: string;
  updatedAt: string;
}
