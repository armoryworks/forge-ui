/** Carrier edit. A field left out is unchanged; an empty code clears it. Credentials are updated separately. */
export interface UpdateCarrierRequest {
  name?: string;
  code?: string | null;
  scac?: string | null;
  integrationKind?: string;
  deliveryUpdateMode?: string;
  integrationServiceId?: string | null;
  requiresScanToShip?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string | null;
}
