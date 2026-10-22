export interface ReorderOperationsRequest {
  operationIds: number[];
  removeConflictingPredecessors?: boolean;
}
