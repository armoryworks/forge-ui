/** One departmental overhead rate — a percentage of direct labor applied to a work center's operations. */
export interface DepartmentalRate {
  workCenterId: number;
  ratePct: number;
}

/** Active costing profile (Tier 2 config). `flat` uses work-center burden rates; `departmental` applies
 *  the per-work-center overhead percentages below. */
export interface CostingProfile {
  mode: 'flat' | 'departmental';
  departmentalRates: DepartmentalRate[];
}
