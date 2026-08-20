/**
 * Per-entity "allow manual numbers" flags (mirrors the server
 * {entity}.allow_manual_numbers system settings). Drives whether a create/edit
 * screen offers an editable business-number field.
 */
export interface ManualNumberSettings {
  parts: boolean;
  customers: boolean;
  vendors: boolean;
  leads: boolean;
  salesOrders: boolean;
  quotes: boolean;
  purchaseOrders: boolean;
  shipments: boolean;
  jobs: boolean;
  invoices: boolean;
  payments: boolean;
}

/** Entity keys addressable through {@link ManualNumberSettings}. */
export type ManualNumberEntity = keyof ManualNumberSettings;
