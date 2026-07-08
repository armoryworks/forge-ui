import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { TermsService } from '../../services/terms.service';
import { TermsScope } from '../../models/terms-scope.model';
import { TermsDocument } from '../../models/terms-document.model';
import { CreateTermsDocumentRequest } from '../../models/create-terms-document-request.model';
import { UpdateTermsDocumentRequest } from '../../models/update-terms-document-request.model';

export interface TermsDialogData {
  /** Edit mode — the existing document. Omit to create. */
  terms?: TermsDocument;
  /** Scopes offered in the scope select (create mode, no locked scope). */
  allowedScopes?: TermsScope[];
  /** Create from a customer/part surface: scope fixed, target pre-set + hidden. */
  lockedScope?: TermsScope;
  customerId?: number;
  partId?: number;
  /** Human label for the locked/edit target, shown read-only. */
  targetLabel?: string;
}

/** Result: the saved document (dialog resolves undefined on cancel). */
export type TermsDialogResult = TermsDocument;

/**
 * S3 — reusable create/edit dialog for a terms & conditions document. Shared by
 * the admin terms page (scope selectable, target via entity picker) and the
 * per-customer / per-part terms sections (scope + target locked). Performs the
 * save itself and closes with the saved document; callers just reload on a
 * truthy result. Scope + target are immutable in edit mode.
 */
@Component({
  selector: 'app-terms-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent, SelectComponent,
    DatepickerComponent, ToggleComponent, EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './terms-dialog.component.html',
  styleUrl: './terms-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsDialogComponent {
  private readonly termsService = inject(TermsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef =
    inject(MatDialogRef<TermsDialogComponent, TermsDialogResult | undefined>);
  protected readonly data = inject<TermsDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.terms;

  /** Scope can only be chosen when creating without a locked scope. */
  protected readonly scopeSelectable = !this.isEdit && !this.data.lockedScope;

  private readonly initialScope: TermsScope =
    this.data.terms?.scope ?? this.data.lockedScope ?? this.data.allowedScopes?.[0] ?? 'Company';

  protected readonly saving = signal(false);

  protected readonly scopeOptions: SelectOption[] =
    (this.data.allowedScopes ?? ['Company', 'Customer', 'Part']).map(s => ({
      value: s,
      label: this.translate.instant(`terms.scope.${s.toLowerCase()}`),
    }));

  /** Read-only label shown for a locked scope + target. */
  protected readonly lockedScopeLabel =
    this.translate.instant(`terms.scope.${this.initialScope.toLowerCase()}`);
  protected readonly lockedTargetLabel: string = this.resolveTargetLabel();

  protected readonly form = new FormGroup({
    scope: new FormControl<TermsScope>(this.initialScope, { nonNullable: true, validators: [Validators.required] }),
    customerId: new FormControl<number | null>(this.data.terms?.customerId ?? this.data.customerId ?? null),
    partId: new FormControl<number | null>(this.data.terms?.partId ?? this.data.partId ?? null),
    title: new FormControl<string>(this.data.terms?.title ?? '', {
      nonNullable: true, validators: [Validators.required, Validators.maxLength(200)],
    }),
    summary: new FormControl<string>(this.data.terms?.summary ?? '', {
      nonNullable: true, validators: [Validators.maxLength(500)],
    }),
    bodyMarkdown: new FormControl<string>(this.data.terms?.bodyMarkdown ?? '', {
      nonNullable: true, validators: [Validators.required],
    }),
    effectiveFrom: new FormControl<Date | null>(
      this.data.terms?.effectiveFrom ? new Date(this.data.terms.effectiveFrom) : null, [Validators.required],
    ),
    effectiveTo: new FormControl<Date | null>(
      this.data.terms?.effectiveTo ? new Date(this.data.terms.effectiveTo) : null,
    ),
    sortOrder: new FormControl<number>(this.data.terms?.sortOrder ?? 0, {
      nonNullable: true, validators: [Validators.required, Validators.min(0)],
    }),
    isActive: new FormControl<boolean>(this.data.terms?.isActive ?? true, { nonNullable: true }),
  });

  private readonly scope = toSignal(this.form.controls.scope.valueChanges, {
    initialValue: this.form.controls.scope.value,
  });
  protected readonly showCustomerPicker = computed(() => this.scopeSelectable && this.scope() === 'Customer');
  protected readonly showPartPicker = computed(() => this.scopeSelectable && this.scope() === 'Part');

  protected readonly violations = FormValidationService.getViolations(this.form, {
    scope: this.translate.instant('terms.fields.scope'),
    customerId: this.translate.instant('terms.fields.customer'),
    partId: this.translate.instant('terms.fields.part'),
    title: this.translate.instant('terms.fields.title'),
    summary: this.translate.instant('terms.fields.summary'),
    bodyMarkdown: this.translate.instant('terms.fields.body'),
    effectiveFrom: this.translate.instant('terms.fields.effectiveFrom'),
    sortOrder: this.translate.instant('terms.fields.sortOrder'),
  });

  constructor() {
    // A Customer/Part scope requires the matching target id. Keep the required
    // validators in sync with the chosen scope (only matters in create mode).
    this.form.controls.scope.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(scope => this.applyScopeTargetValidators(scope));
    this.applyScopeTargetValidators(this.form.controls.scope.value);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const payload: CreateTermsDocumentRequest = {
      scope: f.scope,
      customerId: f.scope === 'Customer' ? f.customerId : null,
      partId: f.scope === 'Part' ? f.partId : null,
      title: f.title.trim(),
      summary: f.summary.trim() || null,
      bodyMarkdown: f.bodyMarkdown,
      effectiveFrom: toIsoDate(f.effectiveFrom)!,
      effectiveTo: toIsoDate(f.effectiveTo),
      isActive: f.isActive,
      sortOrder: f.sortOrder,
    };

    const existing = this.data.terms;
    const request$ = existing
      ? this.termsService.update(existing.id, payload as UpdateTermsDocumentRequest)
      : this.termsService.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(existing ? 'terms.updated' : 'terms.created'));
        this.dialogRef.close(saved);
      },
      // Server rejections (e.g. 403 on company scope) are toasted globally.
      error: () => this.saving.set(false),
    });
  }

  private applyScopeTargetValidators(scope: TermsScope): void {
    const { customerId, partId } = this.form.controls;
    customerId.setValidators(scope === 'Customer' ? [Validators.required] : []);
    partId.setValidators(scope === 'Part' ? [Validators.required] : []);
    customerId.updateValueAndValidity({ emitEvent: false });
    partId.updateValueAndValidity({ emitEvent: false });
  }

  private resolveTargetLabel(): string {
    if (this.data.targetLabel) return this.data.targetLabel;
    const t = this.data.terms;
    if (t?.scope === 'Customer') return t.customerName ?? (t.customerId != null ? `#${t.customerId}` : '');
    if (t?.scope === 'Part') return t.partName ?? (t.partId != null ? `#${t.partId}` : '');
    return '';
  }
}
