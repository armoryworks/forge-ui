export interface UserIntegrationSummary {
  id: number;
  category: string;
  providerId: string;
  displayName: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface IntegrationProviderInfo {
  providerId: string;
  category: string;
  displayName: string;
  authType: string;
  description: string | null;
  icon: string | null;
}

export interface CreateIntegrationRequest {
  category: string;
  providerId: string;
  displayName: string | null;
  credentialsJson: string;
  configJson?: string | null;
}
