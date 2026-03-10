import { TourDefinition } from '../services/tour.service';

export const KANBAN_TOUR: TourDefinition = {
  id: 'kanban-board',
  steps: [
    {
      popover: {
        title: 'Welcome to the Kanban Board',
        description: 'This is where you manage your jobs through each production stage. Let\'s take a quick tour.',
      },
    },
    {
      element: '.track-selector',
      popover: {
        title: 'Track Type Selector',
        description: 'Switch between different board types — Production, R&D, Maintenance, and custom tracks.',
        side: 'bottom',
      },
    },
    {
      element: '.kanban-board',
      popover: {
        title: 'Board Columns',
        description: 'Each column represents a stage. Drag cards between columns to move jobs through the pipeline.',
        side: 'top',
      },
    },
    {
      element: '.kanban-card',
      popover: {
        title: 'Job Cards',
        description: 'Click a card to view details. Ctrl+Click to multi-select for bulk actions.',
        side: 'right',
      },
    },
  ],
};
