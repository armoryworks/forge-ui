/** regulatory-watchtower: a proposed regulatory change awaiting admin review. */
export interface RegulatoryProposal {
  id: number;
  regulatorySourceId: number;
  sourceName: string;
  title: string;
  summaryUrl: string | null;
  details: string | null;
  status: string; // Pending | Applied | Dismissed
  targetEventTypeId: number | null;
  createdAt: string;
}
