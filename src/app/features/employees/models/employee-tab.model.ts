/** Tabs of the employee detail page, in tab-bar order; the URL `:tab` segment must be one of these. */
export const EMPLOYEE_TABS = ['overview', 'time', 'pay', 'training', 'compliance', 'jobs', 'events', 'expenses', 'documents', 'activity'] as const;

export type EmployeeTab = (typeof EMPLOYEE_TABS)[number];
