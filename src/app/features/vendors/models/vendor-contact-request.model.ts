export interface VendorContactRequest {
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  isPrimary: boolean;
  notes: string | null;
}
