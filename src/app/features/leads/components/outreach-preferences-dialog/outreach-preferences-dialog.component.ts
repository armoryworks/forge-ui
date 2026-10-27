import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { LeadsService } from '../../services/leads.service';
import { OutreachPreferences } from '../../models/suppression.model';
import { OutreachPreferencesSource } from '../../models/outreach-preferences-source.model';

export interface OutreachPreferencesDialogData {
  leadId?: number;
  leadName: string;
  suppress?: boolean;
  /** Where the preferences live when they are not a lead's (a customer contact's). */
  source?: OutreachPreferencesSource;
  /** Overrides the lead-worded introduction. */
  introKey?: string;
}

/**
 * Edits a lead's outreach preferences — per-channel opt-outs (with where the request came from) and a
 * do-not-contact-until date — and saves them to the lead's preferences row, which is what the
 * suppression list and outreach queues honour. Closes with the saved preferences, or `undefined`.
 */
@Component({
  selector: 'app-outreach-preferences-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, DatepickerComponent, InputComponent, ToggleComponent, ValidationButtonComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './outreach-preferences-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutreachPreferencesDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<OutreachPreferencesDialogComponent, OutreachPreferences | undefined>);
  private readonly leads = inject(LeadsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<OutreachPreferencesDialogData>(MAT_DIALOG_DATA);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    emailOptOut: new FormControl<boolean>(false, { nonNullable: true }),
    callOptOut: new FormControl<boolean>(false, { nonNullable: true }),
    smsOptOut: new FormControl<boolean>(false, { nonNullable: true }),
    source: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    cooldownUntil: new FormControl<Date | null>(null),
    cooldownNotes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    source: this.translate.instant('leads.outreachPrefs.source'),
    cooldownNotes: this.translate.instant('leads.outreachPrefs.cooldownNotes'),
  });

  ngOnInit(): void {
    this.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (prefs) => {
        this.loading.set(false);
        this.seed(prefs);
      },
      error: () => {
        this.loading.set(false);
        this.seed(null);
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const source = f.source.trim() || undefined;
    this.saving.set(true);
    const request = {
      emailOptOut: f.emailOptOut,
      emailOptOutSource: f.emailOptOut ? source : undefined,
      callOptOut: f.callOptOut,
      callOptOutSource: f.callOptOut ? source : undefined,
      smsOptOut: f.smsOptOut,
      smsOptOutSource: f.smsOptOut ? source : undefined,
      cooldownUntil: f.cooldownUntil ? (toIsoDate(f.cooldownUntil) ?? null) : null,
      cooldownNotes: f.cooldownNotes.trim() || undefined,
    };
    const save = this.data.source
      ? this.data.source.save(request)
      : this.leads.updateOutreachPreferences(this.data.leadId ?? 0, request);
    save.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('leads.outreachPrefs.saved'));
        this.dialogRef.close(saved);
      },
      error: () => this.saving.set(false),
    });
  }

  private load(): Observable<OutreachPreferences | null> {
    return this.data.source ? this.data.source.load() : this.leads.getOutreachPreferences(this.data.leadId ?? 0);
  }

  private seed(prefs: OutreachPreferences | null): void {
    const nothingSet = !prefs || (!prefs.emailOptOut && !prefs.callOptOut && !prefs.smsOptOut && !prefs.cooldownUntil);
    if (this.data.suppress && nothingSet) {
      this.form.patchValue({
        emailOptOut: true,
        callOptOut: true,
        smsOptOut: true,
        source: this.translate.instant('leads.outreachPrefs.queueSource'),
      });
      return;
    }
    if (!prefs) return;
    this.form.patchValue({
      emailOptOut: prefs.emailOptOut,
      callOptOut: prefs.callOptOut,
      smsOptOut: prefs.smsOptOut,
      source: prefs.emailOptOutSource ?? prefs.callOptOutSource ?? prefs.smsOptOutSource ?? '',
      cooldownUntil: prefs.cooldownUntil ? new Date(prefs.cooldownUntil) : null,
      cooldownNotes: prefs.cooldownNotes ?? '',
    });
  }
}
