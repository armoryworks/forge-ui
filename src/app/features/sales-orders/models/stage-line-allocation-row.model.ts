/** One sales order line in the assign-lines dialog: what it ordered and how much other stages already hold. */
export interface StageLineAllocationRow {
  salesOrderLineId: number;
  lineNumber: number;
  label: string;
  ordered: number;
  elsewhere: number;
  available: number;
}
