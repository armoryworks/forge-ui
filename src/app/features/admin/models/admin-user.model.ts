export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  hasPassword: boolean;
  hasPendingSetupToken: boolean;
  hasRfidIdentifier: boolean;
  hasBarcodeIdentifier: boolean;
}
