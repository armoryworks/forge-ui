/** A saved configuration: the selections, the quantity and price they came to, and the quote or part made from it. */
export interface ProductConfiguration {
  id: number;
  configuratorId: number;
  configuratorName: string;
  configurationCode: string;
  selectionsJson: string;
  computedPrice: number;
  generatedBomJson: string | null;
  generatedRoutingJson: string | null;
  quoteId: number | null;
  partId: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  quantity: number;
}
