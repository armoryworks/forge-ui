import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  readonly title = input.required<string>();
  readonly width = input<string>('420px');
  readonly closed = output<void>();
}
