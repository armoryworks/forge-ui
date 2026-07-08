import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { PaymentSchedule } from '../../models/payment-schedule.model';
import { CurrencyDisplayComponent } from '../currency-display/currency-display.component';

/** Per-milestone render model — chip class/status key precomputed so the template stays binding-only. */
interface MilestoneView {
  id: number;
  name: string;
  percentage: number;
  amountDue: number;
  chipClass: string;
  statusKey: string;
  waived: boolean;
}

const STATUS_CHIP_CLASS: Record<string, string> = {
  Pending: 'chip chip--muted',
  Due: 'chip chip--warning',
  Invoiced: 'chip chip--info',
  PartiallyPaid: 'chip chip--warning',
  Paid: 'chip chip--success',
  Waived: 'chip chip--muted',
};

/**
 * Compact paid-vs-remaining progress for a payment schedule (S2): a
 * proportional two-segment bar plus one dense row per milestone. Dumb
 * component — inputs only; drop it into any 400px detail panel (quote today,
 * sales order later) and feed it the schedule read model.
 */
@Component({
  selector: 'app-payment-progress',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, CurrencyDisplayComponent],
  templateUrl: './payment-progress.component.html',
  styleUrl: './payment-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentProgressComponent {
  readonly schedule = input.required<PaymentSchedule>();

  /** Paid share of the document total, clamped to 0-100 (0 when the total is 0). */
  protected readonly paidPct = computed(() => {
    const totals = this.schedule().totals;
    if (totals.documentTotal <= 0) return 0;
    return Math.min(100, Math.max(0, (totals.paidTotal / totals.documentTotal) * 100));
  });

  protected readonly remainingPct = computed(() => 100 - this.paidPct());

  protected readonly milestoneViews = computed<MilestoneView[]>(() =>
    this.schedule().milestones.map(m => ({
      id: m.id,
      name: m.name,
      percentage: m.percentage,
      amountDue: m.amountDue,
      chipClass: STATUS_CHIP_CLASS[m.status] ?? 'chip chip--muted',
      statusKey: 'shared.paymentProgress.status' + m.status,
      waived: m.status === 'Waived',
    })),
  );
}
