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
      element: 'app-detail-side-panel',
      title: 'Part Detail Panel',
      description: 'View specs, BOM entries, usage (where-used), and file attachments in the side panel.',
      side: 'left',
    },
  ],
};
