export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  hireDate?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employeeNumber?: string | null;
  workEmail?: string | null;
  phoneNumber?: string | null;
}
