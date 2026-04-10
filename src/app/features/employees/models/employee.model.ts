export interface EmployeeListItem {
  id: number;
  firstName: string;
  lastName: string;
  initials?: string;
  avatarColor?: string;
  email: string;
  phone?: string;
  role: string;
  teamName?: string;
  teamId?: number;
  isActive: boolean;
  jobTitle?: string;
  department?: string;
  startDate?: string;
  createdAt: string;
}

export interface EmployeeDetail {
  id: number;
  firstName: string;
  lastName: string;
  initials?: string;
  avatarColor?: string;
  email: string;
  phone?: string;
  role: string;
  teamName?: string;
  teamId?: number;
  isActive: boolean;
  jobTitle?: string;
  department?: string;
  startDate?: string;
  createdAt: string;
  workLocationId?: number;
  workLocationName?: string;
  pinConfigured: boolean;
  hasRfidIdentifier: boolean;
  hasBarcodeIdentifier: boolean;
  personalEmail?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  complianceCompletedItems: number;
  complianceTotalItems: number;
}

export interface EmployeeStats {
  hoursThisPeriod: number;
  compliancePercent: number;
  activeJobCount: number;
  trainingProgressPercent: number;
  outstandingExpenseCount: number;
  outstandingExpenseTotal: number;
}

export interface EmployeeTimeEntry {
  id: number;
  date: string;
  durationMinutes: number;
  category?: string;
  notes?: string;
  jobNumber?: string;
  jobTitle?: string;
  isManual: boolean;
  createdAt: string;
}

export interface EmployeePayStub {
  id: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: number;
  netPay: number;
  totalDeductions: number;
  totalTaxes: number;
}

export interface EmployeeJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName?: string;
  stageColor?: string;
  trackTypeName?: string;
  priority?: string;
  dueDate?: string;
  createdAt: string;
}

export interface EmployeeExpense {
  id: number;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface EmployeeTraining {
  id: number;
  moduleName: string;
  moduleType: string;
  pathName?: string;
  status: string;
  quizScore?: number;
  completedAt?: string;
  startedAt?: string;
}

export interface EmployeeCompliance {
  id: number;
  formName: string;
  formType: string;
  status: string;
  signedAt?: string;
  createdAt: string;
}
