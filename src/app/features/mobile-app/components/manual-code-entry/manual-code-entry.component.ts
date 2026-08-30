import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';

/**
 * The quiet fallback when the camera can't read a label: a printed id
 * typed or pasted in, handed to the same resolve path a decode uses.
 */
@Component({
  selector: 'app-manual-code-entry',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './manual-code-entry.component.html',
  styleUrl: './manual-code-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualCodeEntryComponent {
  readonly submitted = output<string>();
  readonly dismissed = output<void>();

  protected readonly control = new FormControl('', { nonNullable: true });

  protected submit(): void {
    const value = this.control.value.trim();
    if (!value) return;
    this.submitted.emit(value);
    this.control.reset();
  }
}
