import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type KpiChangeDirection = 'up' | 'down' | 'neutral';

export function kpiChangeDirection(change: number, higherIsBetter: boolean): KpiChangeDirection {
  if (change === 0) return 'neutral';
  return (change > 0) === higherIsBetter ? 'up' : 'down';
}

@Component({
  selector: 'app-kpi-chip',
  standalone: true,
  templateUrl: './kpi-chip.component.html',
  styleUrl: './kpi-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiChipComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly change = input<string | null>(null);
  readonly changeDirection = input<KpiChangeDirection>('neutral');
  readonly valueColor = input<'default' | 'warn' | 'success' | 'primary'>('default');
}
