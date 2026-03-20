import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { HelpTourService } from '../../services/help-tour.service';

@Component({
  selector: 'app-page-layout',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
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
