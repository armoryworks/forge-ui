export interface AccountingProviderInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiresOAuth: boolean;
  isConfigured: boolean;
  logoUrl?: string | null;
}
