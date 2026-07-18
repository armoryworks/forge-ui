import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { Gs1Service } from '../services/gs1.service';
import { Gs1Settings } from './models/gs1-settings.model';

/**
 * Admin GS1 settings — optional GTIN barcode identity. An install that has
 * licensed GS1 enters its company prefix here; once set, parts can be assigned
 * globally-unique GTINs (for retail / marketplace channels). Leaving the prefix
 * blank keeps every part on its free internal barcode. Admin/Manager can view;
 * only Admin can save. The whole page is capability-gated at the route
 * (CAP-MD-GS1) and again server-side.
 */
@Component({
  selector: 'app-gs1',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    PageLayoutComponent, InputComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './gs1.component.html',
  styleUrl: './gs1.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gs1Component implements OnInit {
  private readonly gs1Service = inject(Gs1Service);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly settings = signal<Gs1Settings | null>(null);
  protected readonly canEdit = this.auth.hasRole('Admin');

  protected readonly configured = computed(() => this.settings()?.configured ?? false);
  protected readonly remainingCapacity = computed(() => this.settings()?.remainingCapacity ?? 0);

  /** Optional: empty clears the prefix (internal-only). When present it must be 6–11 digits. */
  private readonly prefixValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    return /^\d{6,11}$/.test(value) ? null : { format: { message: 'Company prefix must be 6–11 digits.' } };
  };

  protected readonly form = new FormGroup({
    companyPrefix: new FormControl<string>('', { nonNullable: true, validators: [this.prefixValidator] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    companyPrefix: 'Company Prefix',
  });

  ngOnInit(): void {
    this.gs1Service.getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => this.applySettings(settings),
        error: () => this.loading.set(false),
      });
  }

  protected save(): void {
    if (!this.canEdit || this.form.invalid) return;
    const raw = this.form.getRawValue().companyPrefix.trim();
    const prefix = raw.length > 0 ? raw : null;

    this.saving.set(true);
    this.gs1Service.updateSettings(prefix).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('admin.gs1.saved'));
        // Refetch so `configured` + `remainingCapacity` reflect the new prefix.
        this.gs1Service.getSettings().subscribe({
          next: (settings) => {
            this.applySettings(settings);
            this.saving.set(false);
          },
          error: () => this.saving.set(false),
        });
      },
      error: () => this.saving.set(false),
    });
  }

  private applySettings(settings: Gs1Settings): void {
    this.settings.set(settings);
    this.form.reset({ companyPrefix: settings.companyPrefix ?? '' });
    if (!this.canEdit) this.form.disable();
    this.loading.set(false);
  }
}
