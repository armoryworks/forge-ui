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
      description: 'Switch between Stock Levels, Locations, Movements, Receiving, Stock Ops, Cycle Counts and Reservations, plus Inspection, Replenishment and Units of Measure when they are available to you.',
      side: 'bottom',
    },
    {
      element: 'app-data-table',
      title: 'Inventory Table',
      description: 'Search by part number or description. Expand a row to see stock in each bin.',
      side: 'top',
    },
  ],
};
