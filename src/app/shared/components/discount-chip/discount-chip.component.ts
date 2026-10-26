import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DateOnlyPipe } from '../../pipes/date-only.pipe';
import { daysUntil } from '../../utils/date.utils';

/**
 * "2% until 02/04/2026" — the early-payment discount still open on a document. Renders nothing once the deadline has
 * passed or no discount is left, so lists and aging rows can place it unconditionally.
 */
@Component({
  selector: 'app-discount-chip',
  standalone: true,
  imports: [TranslatePipe, DateOnlyPipe],
  templateUrl: './discount-chip.component.html',
  styleUrl: './discount-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscountChipComponent {
  readonly percent = input<number | null | undefined>(null);
  readonly deadline = input<Date | string | null | undefined>(null);
  readonly available = input<number | null | undefined>(null);

  protected readonly open = computed(() => {
    const deadline = this.deadline();
    return !!deadline && (this.available() ?? 0) > 0 && daysUntil(deadline) >= 0;
  });
}
