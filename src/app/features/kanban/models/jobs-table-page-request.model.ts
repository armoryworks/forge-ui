export interface JobsTablePageRequest {
  page: number;
  pageSize: number;
  sort: string | null;
  order: 'asc' | 'desc';
  filters: string[];
}
