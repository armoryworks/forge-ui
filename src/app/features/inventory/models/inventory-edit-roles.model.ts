/** Roles that may receive, move, count and reserve stock. The Production Planner reads inventory without changing it. */
export const INVENTORY_EDIT_ROLES: readonly string[] = ['Admin', 'Manager', 'OfficeManager', 'Engineer', 'ProductionWorker'];
