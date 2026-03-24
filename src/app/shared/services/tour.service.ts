import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { UserPreferencesService } from './user-preferences.service';
import { createTourSvg, clearTourConnector, updateTourConnector } from '../utils/tour-connector.utils';

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
  private readonly prefs  = inject(UserPreferencesService);
  private readonly router = inject(Router);

  private driverInstance: unknown = null;
  private tourSvg: SVGSVGElement | null = null;

  async startTour(tour: TourDefinition, force = false): Promise<void> {
    const prefKey = `tour:${tour.id}`;
    if (!force && this.prefs.get(prefKey)) return;

    // Reflect tutorial state in the URL so it's bookmarkable / shareable
    this.router.navigate([], {
      queryParams: { tutorial: tour.id },
      queryParamsHandling: 'merge',
    });

    const { driver } = await import('driver.js');

    this.tourSvg = createTourSvg();
    document.body.appendChild(this.tourSvg);

    const svg = this.tourSvg;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0,        // No dark backdrop — SVG connector handles focus
      stagePadding: 0,          // We draw our own highlight rect
      stageRadius: 0,
      popoverClass: 'qb-tour-popover',
      steps: tour.steps.map(s => ({
        element: s.element,
        popover: s.popover,
      })),
      onHighlighted: () => {
        requestAnimationFrame(() => updateTourConnector(svg));
      },
      onDeselected: () => {
        clearTourConnector(svg);
      },
      onDestroyed: () => {
        this.prefs.set(prefKey, 'completed');
        this.driverInstance = null;
        svg.remove();
        this.tourSvg = null;
        // Remove tutorial query param from URL
        this.router.navigate([], {
          queryParams: { tutorial: null },
          queryParamsHandling: 'merge',
        });
      },
    });

    this.driverInstance = driverObj;
    driverObj.drive();
  }

  /** Start a tour if the URL contains ?tutorial=<tourId>. Call from feature component ngOnInit. */
  startFromUrl(tourId: string, tour: TourDefinition): void {
    // Parsed by the calling component from ActivatedRoute.snapshot.queryParamMap
    this.startTour(tour, true);
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
