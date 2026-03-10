import { TourDefinition } from '../services/tour.service';

export const DASHBOARD_TOUR: TourDefinition = {
  id: 'dashboard',
  steps: [
    {
      popover: {
        title: 'Your Dashboard',
        description: 'This is your personalized overview. Widgets show key metrics and upcoming work.',
      },
    },
    {
      element: '.dashboard-grid',
      popover: {
        title: 'Dashboard Widgets',
        description: 'Drag and resize widgets to customize your layout. Your preferences are saved automatically.',
        side: 'top',
      },
    },
    {
      element: 'app-mini-calendar-widget',
      popover: {
        title: 'Calendar',
        description: 'Highlighted dates show upcoming deadlines. Click a date to see jobs due that day.',
        side: 'left',
      },
    },
  ],
};
