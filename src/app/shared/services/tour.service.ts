import { Injectable, inject } from '@angular/core';

import { UserPreferencesService } from './user-preferences.service';

export interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
  };
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly prefs = inject(UserPreferencesService);
  private driverInstance: unknown = null;

  async startTour(tour: TourDefinition, force = false): Promise<void> {
    const prefKey = `tour:${tour.id}`;
    if (!force && this.prefs.get(prefKey)) return;

    const { driver } = await import('driver.js');

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(0,0,0,0.5)',
      stagePadding: 8,
      stageRadius: 0,
      popoverClass: 'qb-tour-popover',
      steps: tour.steps.map(s => ({
        element: s.element,
        popover: s.popover,
      })),
      onDestroyed: () => {
        this.prefs.set(prefKey, 'completed');
        this.driverInstance = null;
      },
    });

    this.driverInstance = driverObj;
    driverObj.drive();
  }

  resetTour(tourId: string): void {
    this.prefs.remove(`tour:${tourId}`);
  }

  resetAllTours(): void {
    const allPrefs = this.prefs.getAll();
    for (const key of Object.keys(allPrefs)) {
      if (key.startsWith('tour:')) {
        this.prefs.remove(key);
      }
    }
  }
}
