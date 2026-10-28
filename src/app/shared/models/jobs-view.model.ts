import { ViewModeOption } from './view-mode-option.model';

/** Per-user preference key for how the jobs screen opens: the kanban board or the jobs table. */
export const JOBS_VIEW_PREF_KEY = 'kanban:defaultView';

export type JobsViewMode = 'board' | 'table';

export const DEFAULT_JOBS_VIEW: JobsViewMode = 'board';

/** Narrowest viewport, in CSS pixels, that offers the jobs table; narrower screens always get the board. */
export const JOBS_TABLE_MIN_WIDTH = 1024;

/** Segments of the view toggle on the jobs screen; the team view is the board laid out in one row per assignee. */
export const JOBS_SCREEN_VIEW_OPTIONS: readonly ViewModeOption<JobsViewMode | 'team'>[] = [
  { mode: 'board', icon: 'view_kanban', labelKey: 'jobsTable.viewBoard' },
  { mode: 'team', icon: 'people', labelKey: 'kanban.team' },
  { mode: 'table', icon: 'table_rows', labelKey: 'jobsTable.viewTable' },
];

/** Options for the profile customization selector. */
export const JOBS_VIEW_OPTIONS: readonly { value: JobsViewMode; labelKey: string }[] = [
  { value: 'board', labelKey: 'account.jobsViewBoard' },
  { value: 'table', labelKey: 'account.jobsViewTable' },
];
