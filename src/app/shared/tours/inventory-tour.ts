import { TourDefinition } from '../services/help-tour.service';

export const INVENTORY_TOUR: TourDefinition = {
  id: 'inventory',
  steps: [
    {
      title: 'Inventory Management',
      description: 'Track stock levels across locations, receive purchase orders, and manage cycle counts.',
    },
    {
      element: '.tab-bar',
      title: 'Inventory Tabs',
      description: 'Switch between Stock Levels, Receiving, Stock Operations, and Cycle Counts.',
      side: 'bottom',
    },
    {
      element: 'app-data-table',
      title: 'Inventory Table',
      description: 'View stock by location. Expandable rows show bin-level detail. Use column filters for quick lookup.',
      side: 'top',
    },
  ],
};
