export interface ReorderOperationsRequest {
  operationIds: number[];
  removeConflictingPredecessors?: boolean;
  routingVersion?: string | null;
}
