export interface ServerPageState {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  sort: string | null;
  order: 'asc' | 'desc';
}

export type ServerPageRequest = Omit<ServerPageState, 'totalCount'>;
