export interface JobPart {
  id: number;
  jobId: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  partStatus: string;
  quantity: number;
  notes: string | null;
}
