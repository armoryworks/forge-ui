import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Info affordance for a business number that manual numbering allows editing in
 * principle, but this record's lifecycle does not (a posted invoice, an applied
 * payment, a shipped shipment). Callers render it only when the manual-number
 * setting is on — with the setting off there is nothing to explain.
 */
@Component({
  selector: 'app-number-lock-info',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './number-lock-info.component.html',
  styleUrl: './number-lock-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberLockInfoComponent {
  /** Already-translated sentence explaining why this number is fixed. */
  readonly reason = input.required<string>();
}
