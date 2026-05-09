import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SettingsCatalogEntry } from '../models/setting-entry.model';

/**
 * Phase 1m — type-aware editor for one setting descriptor. Renders the
 * right control based on entry.dataType:
 *   String, Url, Integer    → app-input
 *   Secret                  → app-input (type=password) with reveal toggle
 *   Boolean                 → app-toggle
 *   Enum                    → app-select with descriptor's choices
 *   Json                    → app-textarea (validation lives server-side)
 *
 * Save-on-blur: an internal FormControl mirrors the entry value; on
 * blur, when the value differs from the persisted value, emits
 * (saved). Empty input on a Secret field is treated as "leave alone"
 * — the user must clear explicitly via a separate "Clear" affordance
 * to avoid accidentally erasing a stored secret while clicking around.
 */
@Component({
  selector: 'app-setting-field',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, TextareaComponent,
  ],
  templateUrl: './setting-field.component.html',
  styleUrl: './setting-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingFieldComponent {
  readonly entry = input.required<SettingsCatalogEntry>();
  readonly saved = output<string | null>();

  protected readonly control = new FormControl<string>('', { nonNullable: true });
  protected readonly secretRevealed = signal(false);

  /** Map descriptor choices to SelectComponent's option shape. */
  protected readonly enumOptions = computed<SelectOption[]>(() => {
    const choices = this.entry().choices ?? [];
    return choices.map(c => ({ value: c.value, label: c.label }));
  });

  /** Show "(default)" when the entry is unset and a default value exists. */
  protected readonly defaultHint = computed(() => {
    const e = this.entry();
    if (e.hasValue) return null;
    if (!e.defaultValue) return null;
    if (e.isSecret) return null; // never echo secret defaults
    return e.defaultValue;
  });

  protected get inputType(): 'text' | 'number' | 'password' {
    const e = this.entry();
    if (e.isSecret && !this.secretRevealed()) return 'password';
    if (e.dataType === 'Integer') return 'number';
    return 'text';
  }

  constructor() {
    // Sync the FormControl whenever the bound entry changes (group
    // navigation, post-save refresh). Skip emit on the programmatic
    // sync so the initial value doesn't trigger a save round-trip.
    effect(() => {
      const e = this.entry();
      const value = this.displayValueFor(e);
      this.control.setValue(value, { emitEvent: false });
    });
  }

  protected onBlur(): void {
    const e = this.entry();
    const newValue = this.normalize(this.control.value, e);
    const original = this.displayValueFor(e);

    if (newValue === original) return; // unchanged, no save
    if (e.isSecret && (newValue === null || newValue.length === 0)) {
      // Don't auto-erase secrets on accidental blur with empty input —
      // user must use the explicit Clear button.
      this.control.setValue(original, { emitEvent: false });
      return;
    }

    this.saved.emit(newValue);
  }

  protected onToggleSave(checked: boolean): void {
    this.saved.emit(checked ? 'true' : 'false');
  }

  protected onEnumSave(value: string | null): void {
    this.saved.emit(value);
  }

  protected toggleSecretReveal(): void {
    this.secretRevealed.update(v => !v);
  }

  protected clearSecret(): void {
    this.control.setValue('', { emitEvent: false });
    this.saved.emit(null); // server erases the row
  }

  /** Compute the value to display in the control given an entry's state. */
  private displayValueFor(e: SettingsCatalogEntry): string {
    if (e.isSecret && e.hasValue) {
      // Server returned the mask placeholder. Show it, but don't
      // submit it back on save — onBlur compares against this same
      // string and bails when unchanged.
      return e.value ?? '';
    }
    if (e.dataType === 'Boolean') {
      return e.value ?? e.defaultValue ?? 'false';
    }
    return e.hasValue ? (e.value ?? '') : '';
  }

  /** Empty/whitespace input → null (server erases row). Trim everything else. */
  private normalize(value: string, e: SettingsCatalogEntry): string | null {
    if (value === null || value === undefined) return null;
    if (e.dataType === 'Json') return value; // preserve whitespace inside JSON
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
