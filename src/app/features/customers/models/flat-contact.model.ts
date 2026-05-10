export interface FlatContactRow {
  contactId: number;
  customerId: number;
  customerName: string;
  companyName: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
  emailOptOut: boolean;
  callOptOut: boolean;
  inCooldown: boolean;
}
