export interface CreateProjectRequest {
  name: string;
  description: string | null;
  customerId: number | null;
  budgetTotal: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  notes: string | null;
}
