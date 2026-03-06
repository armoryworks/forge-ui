import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-dashboard-widget',
  standalone: true,
  templateUrl: './dashboard-widget.component.html',
  styleUrl: './dashboard-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardWidgetComponent {
  readonly title = input.required<string>();
  readonly icon = input<string>('');
  readonly count = input<number | null>(null);
  readonly widgetKey = input<string>('');
  readonly accent = input<boolean>(false);
}
