export interface AiIndexEntityStatus {
  entityType: string;
  indexedCount: number;
  totalCount: number | null;
  chunkCount: number;
  lastIndexedAt: string | null;
}

export interface AiIndexStatus {
  entityTypes: AiIndexEntityStatus[];
  totalChunks: number;
  lastIndexedAt: string | null;
}
