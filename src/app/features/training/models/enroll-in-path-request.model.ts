export interface EnrollInPathRequest {
  userIds: number[];
  roles: string[];
  dueDate: string | null;
}
