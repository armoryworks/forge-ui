import { TourDefinition } from '../services/help-tour.service';

export const ADMIN_TOUR: TourDefinition = {
  id: 'admin',
  steps: [
    {
      title: 'Admin Settings',
      description: 'Configure users, track types, reference data, terminology, and system settings.',
    },
    {
      element: '.tab-bar',
      title: 'Settings Tabs',
      description: 'Switch between Users, Track Types, Reference Data, Terminology, Branding, and System Settings.',
      side: 'bottom',
    },
    {
      element: 'app-data-table',
      title: 'Data Management',
      description: 'Each tab has its own data table. Create, edit, and manage records from here.',
      side: 'top',
    },
  ],
};
