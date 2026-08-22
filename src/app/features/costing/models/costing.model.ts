/** A Tier-3 costing period and its lifecycle state. */
export interface CostingPeriod {
  id: number;
  startDate: string;
  endDate: string;
  status: 'Open' | 'Frozen' | 'Closed';
  frozenAt: string | null;
  closedAt: string | null;
}

/** A costing cost center with its allocation drivers. */
export interface CostingCostCenter {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  type: 'Production' | 'Support' | 'Sga' | 'Warehouse';
  sqft: number | null;
  headcount: number | null;
  isInventoriable: boolean;
}

/** An overhead pool with its behavior and driver. */
export interface OverheadPool {
  id: number;
  costingCostCenterId: number;
  workCenterId: number | null;
  code: string;
  name: string;
  behavior: 'Fixed' | 'Variable' | 'Semi';
  fixedPortion: number | null;
  driver: 'MachineHour' | 'LaborHour' | 'LaborDollar' | 'MaterialDollar' | 'Unit' | 'ReceiptCount';
}

/** A pool's budget for a period and the derived absorption rate. */
export interface OverheadPoolBudget {
  id: number;
  overheadCostPoolId: number;
  costingPeriodId: number;
  budgetAmount: number;
  budgetDriverQty: number;
  derivedRate: number;
}

/** Frozen per-period cost rates for a work center. */
export interface WorkCenterCostRate {
  id: number;
  workCenterId: number;
  costingPeriodId: number;
  laborRate: number;
  laborOhRate: number;
  machineRate: number;
  machineOhVarRate: number;
  machineOhFixedRate: number;
  frozenAt: string | null;
  frozenBy: string | null;
}

/** Outcome of freezing a period. */
export interface FreezeCostingPeriodResult {
  periodId: number;
  budgetsRated: number;
  workCentersRated: number;
}
