import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OidcAdminService } from '../../services/oidc-admin.service';
import { OidcScopeListItem } from '../../models/oidc-scope-list-item.model';

function jsonObjectValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = ctrl.value;
  if (!v) return null;
  try {
    const parsed = JSON.parse(v);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { invalidJson: true };
    }
    return null;
  } catch {
    return { invalidJson: true };
  }
}

@Component({
  selector: 'app-oidc-scope-editor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './oidc-scope-editor-dialog.component.html',
  styleUrl: './oidc-scope-editor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcScopeEditorDialogComponent {
  private readonly oidc = inject(OidcAdminService);
  private readonly snackbar = inject(SnackbarService);

  readonly scope = input<OidcScopeListItem | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);

  protected readonly isEdit = computed(() => this.scope() !== null);
  protected readonly isSystem = computed(() => this.scope()?.isSystem ?? false);

  protected readonly form = new FormGroup({
    name: new FormControl('', [
      Validators.required,
      Validators.maxLength(100),
      Validators.pattern(/^[a-zA-Z][a-zA-Z0-9._:-]*$/),
    ]),
    displayName: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    claimMappingsJson: new FormControl('{}', [Validators.required, jsonObjectValidator]),
    resourcesCsv: new FormControl(''),
    isActive: new FormControl(true),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Scope name',
    displayName: 'Display name',
    description: 'Description',
    claimMappingsJson: 'Claim mappings JSON',
  });

  constructor() {
    effect(() => {
      const s = this.scope();
      if (s) {
        this.form.patchValue({
          name: s.name,
          displayName: s.displayName,
          description: s.description,
          claimMappingsJson: s.claimMappingsJson || '{}',
          resourcesCsv: s.resourcesCsv ?? '',
          isActive: s.isActive,
        });
        this.form.controls.name.disable();
        if (s.isSystem) {
          this.form.disable();
        }
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving() || this.isSystem()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();

    if (this.isEdit()) {
      const id = this.scope()!.id;
      this.oidc.updateScope(id, {
        displayName: v.displayName!,
        description: v.description!,
        claimMappingsJson: v.claimMappingsJson!,
        resourcesCsv: v.resourcesCsv || null,
        isActive: v.isActive ?? true,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success('Scope updated.');
          this.saved.emit();
          this.closed.emit();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.oidc.createScope({
        name: v.name!,
        displayName: v.displayName!,
        description: v.description!,
        claimMappingsJson: v.claimMappingsJson!,
        resourcesCsv: v.resourcesCsv || null,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success('Scope created.');
          this.saved.emit();
          this.closed.emit();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected delete(): void {
    const s = this.scope();
    if (!s || this.deleting() || s.isSystem) return;
    if (!confirm(`Delete scope "${s.name}"? This cannot be undone.`)) return;
    this.deleting.set(true);
    this.oidc.deleteScope(s.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.snackbar.success('Scope deleted.');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.deleting.set(false),
    });
  }
}
