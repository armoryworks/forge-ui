export interface EmployeeDocument {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  documentType: string | null;
  expirationDate: string | null;
  createdAt: string;
}
