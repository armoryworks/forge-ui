import { Operation } from './operation.model';

export interface RoutingGraph {
  version: string;
  operations: Operation[];
}
