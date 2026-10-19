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
      description: 'All expenses with status tracking. Search by description, filter by status, and sort or filter by any column header. Export to CSV.',
      side: 'top',
    },
    {
      element: '[data-testid="new-expense-btn"]',
      title: 'Create Expense',
      description: 'Click to log a new expense with its amount, date, category and vendor, and attach a receipt photo.',
      side: 'bottom',
    },
  ],
};
