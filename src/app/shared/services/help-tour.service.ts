import { Injectable } from '@angular/core';

export interface TourStep {
  element?: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
}

@Injectable({ providedIn: 'root' })
export class HelpTourService {
  private readonly tours = new Map<string, TourDefinition>();
  private driverInstance: unknown = null;

  register(tour: TourDefinition): void {
    this.tours.set(tour.id, tour);
  }

  async start(tourId: string): Promise<void> {
    const tour = this.tours.get(tourId);
    if (!tour || tour.steps.length === 0) return;

    const { driver } = await import('driver.js');

    const driverObj = driver({
      showProgress: true,
      animate: true,
      steps: tour.steps.map(step => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? 'bottom',
        },
      })),
    });

    this.driverInstance = driverObj;
    driverObj.drive();
  }

  isRegistered(tourId: string): boolean {
    return this.tours.has(tourId);
  }
}
