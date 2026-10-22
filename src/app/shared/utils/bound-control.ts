import { computed, DestroyRef, Injector, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroupDirective, NgControl, NgForm } from '@angular/forms';
import { EMPTY, merge } from 'rxjs';

import { FormValidationService } from '../services/form-validation.service';
import { controlIsRequired } from '../validators/control-is-required';

/**
 * Tracks the form control bound to a shared field component (a
 * ControlValueAccessor host) so the component can draw its required marker
 * and its error line from the control's own validators. Call `attach` from
 * ngAfterContentInit, once the host's NgControl exists.
 */
export class BoundControl {
  private readonly control = signal<AbstractControl | null>(null);
  private readonly version = signal(0);
  private parentForm: FormGroupDirective | NgForm | null = null;

  readonly isRequired = computed(() => {
    this.version();
    return controlIsRequired(this.control());
  });

  attach(injector: Injector, destroyRef: DestroyRef): void {
    const control = injector.get(NgControl, null, { self: true, optional: true })?.control ?? null;
    if (!control) return;
    this.parentForm = injector.get(FormGroupDirective, null, { optional: true })
      ?? injector.get(NgForm, null, { optional: true });
    this.control.set(control);
    merge<unknown[]>(control.events, this.parentForm?.ngSubmit ?? EMPTY)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.version.update(v => v + 1));
  }

  /** First error message for the bound control once it is touched or its form submitted; reactive inside computed(). */
  errorMessage(label: string): string | null {
    this.version();
    const control = this.control();
    if (!control?.invalid || !control.errors) return null;
    if (!control.touched && !this.parentForm?.submitted) return null;
    for (const [key, value] of Object.entries(control.errors)) {
      const message = FormValidationService.messageFor(key, value, label);
      if (message !== null) return message;
    }
    return null;
  }
}
