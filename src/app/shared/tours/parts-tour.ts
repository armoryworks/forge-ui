import { TourDefinition } from '../services/help-tour.service';

export const PARTS_TOUR: TourDefinition = {
  id: 'parts',
  steps: [
    {
      title: 'Parts Catalog',
      description: 'Manage your parts, assemblies, and raw materials. Track BOMs, revisions, and inventory from one place.',
    },
    {
      element: 'app-data-table',
      title: 'Parts Table',
      description: 'Click any row to view part details. Use column headers to sort and filter. Right-click headers for more options.',
      side: 'top',
    },
    {
      element: '[data-testid="new-part-btn"]',
      title: 'Part Details',
      description: 'Clicking a row opens the part in a dialog with tabs for its identity, BOM, routing, cost, inventory, where-used and files. Use New Part to add one, or Import to bring in many from a CSV.',
      side: 'bottom',
    },
  ],
};
