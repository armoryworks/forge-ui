import { TourDefinition } from '../services/help-tour.service';

export const TIME_TRACKING_TOUR: TourDefinition = {
  id: 'time-tracking',
  steps: [
    {
      title: 'Time Tracking',
      description: 'Track time with live timers or manual entries. Link entries to jobs for labor cost reporting.',
    },
    {
      element: 'app-data-table',
      title: 'Time Entries',
      description: 'View all time entries. Active timers highlight green. Same-day entries are editable; past entries are locked.',
      side: 'top',
    },
    {
      element: '.timer-controls',
      title: 'Timer Controls',
      description: 'Start/stop timers linked to jobs. Timer syncs across all your open tabs via SignalR.',
      side: 'bottom',
    },
  ],
};
