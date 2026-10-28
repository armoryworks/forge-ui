import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * "−10% / +10%" — the over/under quantity tolerance on an order line, with the quantities it allows in the tooltip.
 * Renders nothing when both percentages are 0, so tables can place it unconditionally.
 */
@Component({
  selector: 'app-tolerance-band',
  standalone: true,
  imports: [DecimalPipe, MatTooltipModule, TranslatePipe],
  templateUrl: './tolerance-band.component.html',
  styleUrl: './tolerance-band.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToleranceBandComponent {
  readonly overPercent = input<number | null | undefined>(0);
  readonly underPercent = input<number | null | undefined>(0);
  readonly minComplete = input<number | null | undefined>(null);
  readonly maxAccepted = input<number | null | undefined>(null);

  protected readonly visible = computed(() => (this.overPercent() ?? 0) > 0 || (this.underPercent() ?? 0) > 0);
}
