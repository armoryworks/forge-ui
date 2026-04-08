import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-dirty-form-indicator',
  standalone: true,
  imports: [],
  templateUrl: './dirty-form-indicator.component.html',
  styleUrl: './dirty-form-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirtyFormIndicatorComponent {
  readonly dirty = input.required<boolean>();
}
