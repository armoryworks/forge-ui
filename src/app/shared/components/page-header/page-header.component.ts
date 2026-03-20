import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { HelpTourService } from '../../services/help-tour.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  private readonly helpTourService = inject(HelpTourService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly helpTourId = input<string>();

  protected startTour(): void {
    const tourId = this.helpTourId();
    if (tourId) {
      this.helpTourService.start(tourId);
    }
  }
}
