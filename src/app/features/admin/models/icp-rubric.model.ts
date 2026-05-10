/** Phase 1r / Batch 10 — ICP rubric admin models. */
export interface IcpRubric {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  dimensionCount: number;
  createdAt: string;
}

export interface IcpRubricDetail {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  dimensions: IcpDimension[];
  createdAt: string;
}

export interface IcpDimension {
  id: number;
  icpRubricId: number;
  fieldKey: string;
  label: string | null;
  matchSpec: string | null;
  weight: number;
}

export interface CreateIcpRubricRequest {
  name: string;
  description: string | null;
}

export interface UpdateIcpRubricRequest {
  name?: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
}

export interface SaveIcpDimensionRequest {
  id: number | null;
  fieldKey: string;
  label: string | null;
  matchSpec: string | null;
  weight: number;
}
