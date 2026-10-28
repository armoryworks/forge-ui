export interface ServerPageState {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  sort: string | null;
  order: 'asc' | 'desc';
  /** When true, column filters stay available in server-paged mode and travel back in each request. */
  filterable?: boolean;
}

export type ServerPageRequest = Omit<ServerPageState, 'totalCount' | 'filterable'> & {
  /** The table's column filters, keyed by field; sent only when the state is `filterable`. */
  filters?: Record<string, unknown>;
};
