import { TourDefinition } from '../services/help-tour.service';

export const REPORTS_TOUR: TourDefinition = {
  id: 'reports',
  steps: [
    {
      title: 'Reports & Analytics',
      description: 'Explore operational data with 15+ built-in reports. Filter by date range, export to CSV.',
    },
    {
      element: '.report-selector',
      title: 'Report Selector',
      description: 'Choose from categories: My Reports, Jobs, Team, Financial, Inventory, and more.',
      side: 'bottom',
    },
    {
      element: '.report-content',
      title: 'Report View',
      description: 'Charts and data tables update based on your filters. Use the Export button for CSV download.',
      side: 'top',
    },
  ],
};
