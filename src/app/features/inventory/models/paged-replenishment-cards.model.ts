import { ReplenishmentCard } from './replenishment-card.model';

export interface PagedReplenishmentCards {
  data: ReplenishmentCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
