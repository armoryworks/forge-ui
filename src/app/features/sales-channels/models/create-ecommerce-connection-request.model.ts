import { ECommercePlatform } from './ecommerce-connection.model';

export interface CreateECommerceConnectionRequest {
  name: string;
  platform: ECommercePlatform;
  /** Sent once and stored encrypted; never returned by the API. */
  credentials: string;
  storeUrl: string | null;
  autoImportOrders: boolean;
  syncInventory: boolean;
}

export interface UpdateECommerceConnectionRequest {
  name: string;
  /** Blank leaves the stored secret untouched — the API never returns it, so a blank field means "unchanged", not "clear". */
  credentials: string | null;
  storeUrl: string | null;
  isActive: boolean;
  autoImportOrders: boolean;
  syncInventory: boolean;
}
