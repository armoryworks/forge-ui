export interface VendorListItem {
  id: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  poCount: number;
  createdAt: Date;
}
