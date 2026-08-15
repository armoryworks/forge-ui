/** Child rows whose parent didn't make the trip — surfaced by the post-import FK re-validation. */
export interface FkOrphanInfo {
  constraint: string;
  childTable: string;
  parentTable: string;
  rows: number;
}
