import { Deliverable } from './deliverable.model';

export interface DeliverablePage {
  items: Deliverable[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
