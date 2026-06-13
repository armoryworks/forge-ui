// ⚡ EDI BOUNDARY — one partner→our part-number translation row (resolved against the catalog on read).
export interface EdiPartNumberMapRow {
  partnerPartNumber: string;
  ourPartNumber: string;
  ourPartId: number | null;
  ourPartDescription: string | null;
}
