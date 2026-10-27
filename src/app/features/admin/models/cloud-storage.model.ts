export type CloudStorageProviderMode = 'PerUser' | 'ServiceAccount';

export interface CloudStorageProvider {
  id: number;
  providerCode: string;
  mode: CloudStorageProviderMode;
  isActive: boolean;
  rootFolderId: string | null;
  serviceAccountId: string | null;
  credentialsConfigured: boolean;
  tokenExpiresAt: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  linkedRecordCount: number;
  createdAt: string;
}

export interface CloudStorageProviderType {
  code: string;
  capabilityCode: string | null;
  capabilityEnabled: boolean;
  registered: boolean;
}

export interface SaveCloudStorageProviderRequest {
  providerCode?: string;
  mode: CloudStorageProviderMode;
  rootFolderId: string | null;
  serviceAccountId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  isActive: boolean;
}

export interface CloudStorageTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface FolderMapEntry {
  entityType: string;
  pathTemplate: string;
  subfolderNames: string[];
  autoCreateOnEntityCreate: boolean;
}
