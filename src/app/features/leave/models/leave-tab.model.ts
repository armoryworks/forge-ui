export type LeaveTab = 'mine' | 'team' | 'balances' | 'policies';

export const LEAVE_TABS: readonly LeaveTab[] = ['mine', 'team', 'balances', 'policies'];

export const LEAVE_READER_ROLES: readonly string[] = ['Admin', 'Manager', 'OfficeManager', 'Controller'];

export const LEAVE_APPROVER_ROLES: readonly string[] = ['Admin', 'Manager'];

export const LEAVE_TAB_ROLES: Readonly<Record<string, readonly string[]>> = {
  team: LEAVE_READER_ROLES,
  balances: LEAVE_READER_ROLES,
  policies: LEAVE_READER_ROLES,
};
