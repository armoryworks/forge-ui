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
  paymentDate: Date;
  referenceNumber: string | null;
  notes: string | null;
  applications: PaymentApplication[];
  createdAt: Date;
  updatedAt: Date;
}
