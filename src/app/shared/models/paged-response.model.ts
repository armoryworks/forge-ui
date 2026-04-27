/**
 * Standard envelope returned by paginated list endpoints. Matches the server
 * contract introduced in Phase 3 F7-partial / WU-17.
 *
 *   GET /customers?page=1&pageSize=25&sort=createdAt&order=desc&q=acme
 *   -> { items: [...], totalCount: N, page: 1, pageSize: 25 }
 *
 * Customer + part list endpoints are the first to adopt this; WU-22 will
 * sweep the remaining list endpoints.
 */
export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Common query parameters for paginated list endpoints. Entity-specific
 * filters (isActive, type, etc.) extend this in feature-level types.
 */
export interface PagedQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
  dateFrom?: string;   // ISO-8601
  dateTo?: string;     // ISO-8601
}
