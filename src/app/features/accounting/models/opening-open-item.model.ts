/** One opening receivable or payable as keyed or imported — mirrors `OpeningOpenItemRowModel`. */
export interface OpeningOpenItem {
  partyType: 'Customer' | 'Vendor';
  partyId: number | null;
  partyRef: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  dueDate: string | null;
  amount: number;
  description: string | null;
}
