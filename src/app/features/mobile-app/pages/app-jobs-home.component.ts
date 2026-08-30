import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

/** The Jobs tab without a job in hand: point at Scan or Lookup. */
@Component({
  selector: 'app-app-jobs-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './app-jobs-home.component.html',
  styleUrl: './app-jobs-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppJobsHomeComponent {}
