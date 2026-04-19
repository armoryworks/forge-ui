import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-training-mode-banner',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './training-mode-banner.component.html',
  styleUrl: './training-mode-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingModeBannerComponent {
  readonly visible = input(false);
}
