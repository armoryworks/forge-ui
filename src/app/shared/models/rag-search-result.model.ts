export interface RagSearchResult {
  entityType: string;
  entityId: number;
  chunkText: string;
  sourceField: string | null;
  score: number;
}
