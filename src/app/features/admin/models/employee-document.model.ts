export interface EmployeeDocument {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  documentType: string | null;
  expirationDate: Date | null;
  createdAt: Date;
}
