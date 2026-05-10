export interface PortalAccessRow {
  accessId: number;
  contactId: number;
  customerId: number;
  customerName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string | null;
  isEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
