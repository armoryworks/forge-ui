export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  fax?: string;
  role?: string;
  isPrimary: boolean;
}
