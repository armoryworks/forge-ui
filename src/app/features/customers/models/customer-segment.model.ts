/** C3: a persisted customer segment (saved named filter). */
export interface CustomerSegment {
  id: number;
  name: string;
  description: string | null;
  filterCriteria: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Create/update payload for a customer segment. */
export interface CustomerSegmentRequest {
  name: string;
  description: string | null;
  filterCriteria: string | null;
  isActive: boolean;
}
