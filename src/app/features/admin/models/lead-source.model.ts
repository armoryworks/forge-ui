/** Phase 1r / Batch 9 — admin-managed catalogue of lead sources. */
export interface LeadSource {
  id: number;
  name: string;
  code: string;
  description: string | null;
  qualityScore: number;
  lastScoredAt: string | null;
  isActive: boolean;
  leadCount: number;
  createdAt: string;
}

export interface CreateLeadSourceRequest {
  name: string;
  code: string;
  description: string | null;
}

export interface UpdateLeadSourceRequest {
  name?: string;
  description?: string | null;
  isActive: boolean;
}
