export interface CustomerListItem {
  id: number;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  contactCount: number;
  jobCount: number;
  createdAt: string;
}
