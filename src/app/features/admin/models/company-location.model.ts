export interface CompanyLocation {
  id: number;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyProfile {
  name: string;
  phone: string;
  email: string;
  ein: string;
  website: string;
}
