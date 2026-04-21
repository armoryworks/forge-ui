import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-widget',
  standalone: true,
  imports: [RouterLink],
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
  readonly viewAllLink = input<string | null>(null);
  readonly viewAllLabel = input<string>('View all');
}
