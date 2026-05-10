/** Phase 1r / Batch 12 — B2B parent account groupings (multi-contact). */
export interface Account {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  sizeBracket: string | null;
  ownerUserId: number | null;
  contactCount: number;
  leadCount: number;
  createdAt: string;
}

export interface AccountContact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
}

export interface CreateAccountRequest {
  name: string;
  description?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  sizeBracket?: string | null;
}

export interface UpdateAccountRequest {
  name: string;
  description?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  sizeBracket?: string | null;
  ownerUserId?: number | null;
}

export interface UpsertAccountContactRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  isPrimary: boolean;
}
