import { TourDefinition } from '../services/help-tour.service';

export const PLANNING_TOUR: TourDefinition = {
  id: 'planning',
  steps: [
    {
      title: 'Welcome to Planning Cycles',
      description: 'Organize your work into focused planning cycles. Commit backlog jobs, track daily progress, and stay on target.',
    },
    {
      element: '.backlog-panel',
      title: 'Backlog Panel',
      description: 'Browse available jobs not yet committed to a cycle. Search by name or filter by priority.',
      side: 'right',
    },
    {
      element: '.backlog-job__add',
      title: 'Commit Jobs',
      description: 'Click the + button to commit a job to the selected planning cycle.',
      side: 'right',
    },
    {
      element: '.cycle-panel',
      title: 'Cycle Board',
      description: 'View committed jobs, mark them complete, and drag to reorder priorities.',
      side: 'left',
    },
    {
      element: '.cycle-panel__actions',
      title: 'Cycle Lifecycle',
      description: 'Activate a draft cycle to begin work. Complete a cycle to roll over unfinished items or return them to the backlog.',
      side: 'bottom',
    },
  ],
};
