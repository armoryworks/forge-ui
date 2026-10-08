export interface BoardFilters {
  activeOnly: boolean;
  search: string;
  customerId: number | null;
  overdueOnly: boolean;
  onHoldOnly: boolean;
  teamId: number | null;
}
