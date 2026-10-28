export const JOB_CREATE_ROLES = ['Admin', 'Manager', 'PM', 'Engineer', 'OfficeManager'];
export const JOB_EDIT_ROLES = ['Admin', 'Manager'];
/** Roles the job CSV import admits (JobImportsController). */
export const JOB_IMPORT_ROLES = ['Admin', 'Manager'];
/** Roles that may move a job between stages (JobsController PATCH jobs/{id}/stage). */
export const JOB_MOVE_ROLES = ['Admin', 'Manager', 'PM', 'Engineer', 'ProductionWorker', 'OfficeManager', 'Production Planner'];
/** Roles that read a job's customer (the customer picker the board filter uses). */
export const JOB_CUSTOMER_FIELD_ROLES = ['Admin', 'Manager', 'OfficeManager', 'PM', 'Engineer', 'ProductionWorker', 'Production Planner'];
/** Roles that read a job's originating sales order. */
export const JOB_SALES_ORDER_FIELD_ROLES = ['Admin', 'Manager', 'OfficeManager', 'PM', 'Production Planner'];
/** Roles that read a job's billing status and accounting reference (the invoice read). */
export const JOB_BILLING_FIELD_ROLES = ['Admin', 'Manager', 'OfficeManager'];
/** Roles that read a job's estimated cost and quoted price (the job cost summary). */
export const JOB_COST_FIELD_ROLES = ['Admin', 'Manager', 'Engineer', 'PM', 'Controller', 'OfficeManager'];
