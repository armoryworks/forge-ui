/**
 * Shipping carriers — known integrated carriers (UPS/FedEx/USPS/DHL) and custom "shadow" shippers.
 * Mirrors the API's CarrierListItemModel. Credentials are write-only: the secret is never returned —
 * only `credentialsConfigured` + the non-secret client id / environment surface here.
 */
export interface Carrier {
  id: number;
  name: string;
  code: string | null;
  scac: string | null;
  integrationKind: string; // 'Manual' | 'Api'
  deliveryUpdateMode: string; // 'Manual' | 'Poll' | 'Webhook'
  integrationServiceId: string | null;
  requiresScanToShip: boolean;
  isActive: boolean;
  sortOrder: number;
  credentialsConfigured: boolean;
  credentialClientId: string | null;
  credentialEnvironment: string | null;
}

export interface CreateCarrierRequest {
  name: string;
  code?: string | null;
  scac?: string | null;
  integrationKind: string;
  deliveryUpdateMode: string;
  integrationServiceId?: string | null;
  requiresScanToShip: boolean;
  notes?: string | null;
}

/** Write-only credential update. The secret is encrypted server-side and never read back. */
export interface UpdateCarrierCredentialsRequest {
  clientId: string;
  secret: string;
  accountNumber?: string | null;
  environment: string; // 'sandbox' | 'production'
}

/** Result of a live carrier connection test (a sample rate-shop against the carrier API). */
export interface CarrierTestResult {
  success: boolean;
  message: string;
}
