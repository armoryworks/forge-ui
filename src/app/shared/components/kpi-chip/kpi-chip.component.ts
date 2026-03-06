import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
  readonly changeDirection = input<'up' | 'down' | 'neutral'>('neutral');
  readonly valueColor = input<'default' | 'warn' | 'success' | 'primary'>('default');
}
