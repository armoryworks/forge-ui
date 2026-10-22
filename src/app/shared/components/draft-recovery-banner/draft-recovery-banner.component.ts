import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DateTimePipe } from '../../pipes/date-time.pipe';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-draft-recovery-banner',
  standalone: true,
  imports: [DateTimePipe, TranslatePipe],
  templateUrl: './draft-recovery-banner.component.html',
  styleUrl: './draft-recovery-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftRecoveryBannerComponent {
  readonly timestamp = input.required<number>();
  readonly visible = input.required<boolean>();
  readonly discarded = output<void>();
}
