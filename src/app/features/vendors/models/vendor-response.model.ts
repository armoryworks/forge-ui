export interface VendorResponse {
  id: number;
  companyName: string;
  /**
   * Phase 3 H2 / WU-12 — surfaced so dropdowns can grey-out / suffix
   * "(deactivated)" entries and inline-error a previously-loaded form when
   * a selected vendor has since been deactivated.
   */
  isActive: boolean;
}
