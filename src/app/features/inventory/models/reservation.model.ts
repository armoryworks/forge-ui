export interface Reservation {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  binContentId: number;
  locationPath: string;
  jobId: number | null;
  jobTitle: string | null;
  jobNumber: string | null;
  salesOrderLineId: number | null;
  quantity: number;
  notes: string | null;
  createdAt: string;
}
