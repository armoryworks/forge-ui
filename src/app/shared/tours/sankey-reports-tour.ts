import { TourDefinition } from '../services/help-tour.service';

export const SANKEY_REPORTS_TOUR: TourDefinition = {
  id: 'sankey-reports',
  steps: [
    {
      title: 'Sankey Diagrams',
      description: 'See how documents, money and material flow between stages. The wider a band, the larger the flow.',
    },
    {
      element: '.reports-sidebar',
      title: 'Diagram List',
      description: 'Pick a diagram from the list.',
      side: 'right',
    },
    {
      element: '.reports-main',
      title: 'Diagram View',
      description: 'Set the date range and click Apply where a diagram has one. Hover a band to see its value.',
      side: 'left',
    },
  ],
};
