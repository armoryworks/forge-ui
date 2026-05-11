/** Phase 1r — recurring order templates. Hangfire daily job auto-generates SOs. */
export interface RecurringOrderListItem {
  id: number;
  name: string;
  customerId: number;
  customerName: string;
  intervalDays: number;
  nextGenerationDate: string;
  lastGeneratedDate: string | null;
  isActive: boolean;
  lineCount: number;
  createdAt: string;
}

export interface RecurringOrderDetail {
  id: number;
  name: string;
  customerId: number;
  customerName: string;
  shippingAddressId: number | null;
  intervalDays: number;
  nextGenerationDate: string;
  lastGeneratedDate: string | null;
  isActive: boolean;
  notes: string | null;
  lines: RecurringOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface RecurringOrderLine {
  id: number;
  partId: number;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineNumber: number;
}

export interface CreateRecurringOrderRequest {
  name: string;
  customerId: number;
  shippingAddressId?: number | null;
  intervalDays: number;
  nextGenerationDate: string;
  notes?: string | null;
  lines: CreateRecurringOrderLine[];
}

export interface CreateRecurringOrderLine {
  partId: number;
  description: string;
  quantity: number;
  unitPrice: number;
}
