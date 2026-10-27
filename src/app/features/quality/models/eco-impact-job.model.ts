export type EcoImpactRelation = 'Direct' | 'WhereUsed';

export interface EcoImpactJob {
  jobId: number;
  jobNumber: string;
  title: string;
  partId: number;
  partNumber: string | null;
  partRevision: string | null;
  stageName: string | null;
  dueDate: string | null;
  relation: EcoImpactRelation;
}
