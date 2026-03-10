import { TourDefinition } from '../services/help-tour.service';

export const DASHBOARD_TOUR: TourDefinition = {
  id: 'dashboard',
  steps: [
    {
      title: 'Your Dashboard',
      description: 'This is your personalized overview. Widgets show key metrics and upcoming work.',
    },
    {
      element: '.dashboard-grid',
      title: 'Dashboard Widgets',
      description: 'Drag and resize widgets to customize your layout. Your preferences are saved automatically.',
      side: 'top',
    },
    {
      element: 'app-mini-calendar-widget',
      title: 'Calendar',
      description: 'Highlighted dates show upcoming deadlines. Click a date to see jobs due that day.',
      side: 'left',
    },
  ],
};
