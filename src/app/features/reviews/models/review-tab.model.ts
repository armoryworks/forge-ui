export type ReviewTab = 'mine' | 'team' | 'cycles';

export const REVIEW_TABS: readonly ReviewTab[] = ['mine', 'team', 'cycles'];

export const REVIEW_SUPERVISOR_ROLES: readonly string[] = ['Admin', 'Manager'];

/** Tabs only supervisors open; the API serves team reviews and cycles to Admin and Manager only. */
export const REVIEW_TAB_ROLES: Readonly<Record<string, readonly string[]>> = {
  team: REVIEW_SUPERVISOR_ROLES,
  cycles: REVIEW_SUPERVISOR_ROLES,
};
