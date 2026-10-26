import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { timeZoneOptions } from '../../../../shared/utils/time-zone-options';
import { BookSettingsService } from '../../services/book-settings.service';
import { BookSettings } from '../../models/book-settings.model';

const DEFAULT_BOOK_ID = 1;
const BOOK_TIMEZONE_LOCKED = 'book-timezone-locked';

/**
 * Book settings card: the maker-checker threshold (manual entries above it wait for a second approver; blank
 * turns the check off) and the book's reporting time zone, which locks once the book has a posted entry.
 * Read under CAP-ACCT-GL-VIEW; saving needs CAP-ACCT-FULLGL.
 */
@Component({
  selector: 'app-book-settings-card',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, CurrencyInputComponent, SelectComponent, ValidationButtonComponent, LoadingBlockDirective],
  templateUrl: './book-settings-card.component.html',
  styleUrl: './book-settings-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookSettingsCardComponent implements OnInit {
  private readonly service = inject(BookSettingsService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly settings = signal<BookSettings | null>(null);
  protected readonly zoneOptions = signal<SelectOption[]>(timeZoneOptions());
  protected readonly canEdit = computed(() => {
    this.capabilities.capabilities();
    return this.capabilities.isEnabled('CAP-ACCT-FULLGL');
  });
  protected readonly locked = computed(() => this.settings()?.timeZoneLocked ?? false);
  protected readonly companyZoneDiffers = computed(() => {
    const s = this.settings();
    return !!s && !!s.companyTimeZone && s.companyTimeZone !== s.reportingTimeZone && !s.timeZoneLocked;
  });

  protected readonly form = new FormGroup({
    makerCheckerThreshold: new FormControl<number | null>(null, [Validators.min(0)]),
    reportingTimeZone: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    makerCheckerThreshold: this.translate.instant('accounting.bookSettings.threshold'),
    reportingTimeZone: this.translate.instant('accounting.bookSettings.timeZone'),
  });

  ngOnInit(): void {
    this.service.get(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => this.apply(settings),
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.bookSettings.loadFailed');
        },
      });
  }

  protected useCompanyZone(): void {
    const zone = this.settings()?.companyTimeZone;
    if (!zone) return;
    this.form.controls.reportingTimeZone.setValue(zone);
    this.form.markAsDirty();
  }

  protected save(): void {
    const current = this.settings();
    if (!current || this.form.invalid || this.saving() || !this.canEdit()) return;
    const raw = this.form.getRawValue();
    const zone = this.locked() ? null : raw.reportingTimeZone;
    this.saving.set(true);
    this.service.update(current.bookId, raw.makerCheckerThreshold, zone)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings) => {
          this.saving.set(false);
          this.apply(settings);
          this.snackbar.success(this.translate.instant('accounting.bookSettings.saved'));
        },
        error: (err: unknown) => {
          this.saving.set(false);
          if (err instanceof HttpErrorResponse && (err.error as { code?: unknown } | null)?.code === BOOK_TIMEZONE_LOCKED) {
            this.snackbar.error(this.translate.instant('accounting.bookSettings.lockedError'));
          }
        },
      });
  }

  protected cancel(): void {
    const current = this.settings();
    if (current) this.apply(current);
  }

  private apply(settings: BookSettings): void {
    this.settings.set(settings);
    this.zoneOptions.set(timeZoneOptions(settings.reportingTimeZone));
    this.form.reset({
      makerCheckerThreshold: settings.makerCheckerThreshold,
      reportingTimeZone: settings.reportingTimeZone,
    });
    if (settings.timeZoneLocked || !this.canEdit()) this.form.controls.reportingTimeZone.disable();
    else this.form.controls.reportingTimeZone.enable();
    if (this.canEdit()) this.form.controls.makerCheckerThreshold.enable();
    else this.form.controls.makerCheckerThreshold.disable();
    this.loading.set(false);
  }
}
