import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';

const MAX_CODE_LENGTH = 200;

/**
 * The quiet fallback when the camera can't read a label: a printed id
 * typed or pasted in, handed to the same resolve path a decode uses. Capped
 * at the 200 characters the server accepts.
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

  protected readonly maxLength = MAX_CODE_LENGTH;
  protected readonly control = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(MAX_CODE_LENGTH)] });

  protected submit(): void {
    const value = this.control.value.trim();
    if (!value || value.length > MAX_CODE_LENGTH) return;
    this.submitted.emit(value);
    this.control.reset();
  }
}
