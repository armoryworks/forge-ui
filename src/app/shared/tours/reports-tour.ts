import { TourDefinition } from '../services/help-tour.service';

export const REPORTS_TOUR: TourDefinition = {
  id: 'reports',
  steps: [
    {
      title: 'Reports & Analytics',
      description: 'Explore operational and financial data with the built-in reports.',
    },
    {
      element: '.reports-sidebar',
      title: 'Report List',
      description: 'Pick a report from the list. Sankey Diagrams and the Report Builder are at the bottom.',
      side: 'right',
    },
    {
      element: '.reports-main',
      title: 'Report View',
      description: 'Set the date range and click Apply where a report has one. Use the export button in the table header to download the rows.',
      side: 'left',
    },
  ],
};
