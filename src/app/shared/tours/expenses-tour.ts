import { TourDefinition } from '../services/help-tour.service';

export const EXPENSES_TOUR: TourDefinition = {
  id: 'expenses',
  steps: [
    {
      title: 'Expense Tracking',
      description: 'Log expenses, attach receipts, and submit for approval. Managers review in the Approval Queue.',
    },
    {
      element: 'app-data-table',
      title: 'Expense List',
      description: 'All expenses with status tracking. Filter by date, category, or status. Export to CSV.',
      side: 'top',
    },
    {
      element: '.action-btn--primary',
      title: 'Create Expense',
      description: 'Click to log a new expense. Attach receipt photos and link to jobs.',
      side: 'bottom',
    },
  ],
};
