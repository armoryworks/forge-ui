export interface AccountingItem {
  externalId: string | null;
  name: string;
  description: string | null;
  type: string | null;
  unitPrice: number | null;
  purchaseCost: number | null;
  sku: string | null;
  active: boolean;
}
