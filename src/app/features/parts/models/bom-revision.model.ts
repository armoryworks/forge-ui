/**
 * Phase 3 H4 / WU-20 — read-side BOM revision shapes.
 *
 * Mirrors the backend response models (`BomRevisionSummaryResponseModel`
 * and `BomRevisionDetailResponseModel`). The UI uses these for the
 * revision-history widget on the BOM tab and the revision-snapshot
 * dialog. There is no create endpoint — revisions are auto-created
 * server-side on component-list mutations.
 */
export interface BomRevisionSummary {
  id: number;
  partId: number;
  revisionNumber: number;
  effectiveDate: string;
  notes: string | null;
  createdByUserId: number | null;
  createdAt: string;
  entryCount: number;
  isCurrent: boolean;
}

export interface BomRevisionEntrySnapshot {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  quantity: number;
  unitOfMeasure: string;
  operationId: number | null;
  referenceDesignator: string | null;
  sourceType: string;
  leadTimeDays: number | null;
  notes: string | null;
  sortOrder: number;
}

export interface BomRevisionDetail {
  id: number;
  partId: number;
  revisionNumber: number;
  effectiveDate: string;
  notes: string | null;
  createdByUserId: number | null;
  createdAt: string;
  isCurrent: boolean;
  entries: BomRevisionEntrySnapshot[];
}

/** Phase 3 H4 / WU-20 — Job → BOM-at-release surface shape. */
export interface JobBomAtRelease {
  jobId: number;
  partId: number | null;
  bomRevisionId: number | null;
  revisionNumber: number | null;
  effectiveDate: string | null;
  bomHasBeenUpdatedSinceRelease: boolean;
  currentRevisionId: number | null;
  currentRevisionNumber: number | null;
}
