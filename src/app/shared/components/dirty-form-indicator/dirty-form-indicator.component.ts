import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-dirty-form-indicator',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './dirty-form-indicator.component.html',
  styleUrl: './dirty-form-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirtyFormIndicatorComponent {
  readonly dirty = input.required<boolean>();
}
