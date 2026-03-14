import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { HelpTourService } from '../../services/help-tour.service';

@Component({
  selector: 'app-page-layout',
  standalone: true,
  templateUrl: './page-layout.component.html',
  styleUrl: './page-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLayoutComponent {
  private readonly helpTourService = inject(HelpTourService);

  readonly pageTitle = input.required<string>();
  readonly pageSubtitle = input<string>();
  readonly helpTourId = input<string>();

  protected startTour(): void {
    const tourId = this.helpTourId();
    if (tourId) {
      this.helpTourService.start(tourId);
    }
  }
}
