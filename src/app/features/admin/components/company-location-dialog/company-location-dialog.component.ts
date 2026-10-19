import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal, ViewChild } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { CompanyLocation } from '../../models/company-location.model';
import { Address } from '../../../../shared/models/address.model';
import { WorkingCalendarsService } from '../../services/working-calendars.service';

@Component({
  selector: 'app-company-location-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ToggleComponent, SelectComponent,
    AddressFormComponent, ValidationButtonComponent,
  ],
  templateUrl: './company-location-dialog.component.html',
  styleUrl: './company-location-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyLocationDialogComponent implements OnInit {
  private readonly calendars = inject(WorkingCalendarsService);
  private readonly translate = inject(TranslateService);

  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  readonly location = input<CompanyLocation | null>(null);
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly saved = output<Partial<CompanyLocation>>();

  protected draftConfig: DraftConfig = {
    entityType: 'company-location',
    entityId: 'new',
    route: '/admin?tab=settings',
  };

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    phone: new FormControl(''),
    isActive: new FormControl(true),
    address: new FormControl<Address | null>(null),
    workingCalendarId: new FormControl<number | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('companyLocationDialog.locationName'),
  });

  protected readonly calendarOptions = signal<SelectOption[]>([this.defaultCalendarOption()]);

  protected readonly isEdit = signal(false);

  ngOnInit(): void {
    const loc = this.location();
    if (loc) {
      this.isEdit.set(true);
      this.draftConfig = { ...this.draftConfig, entityId: loc.id.toString() };
      this.form.patchValue({
        name: loc.name,
        phone: loc.phone ?? '',
        isActive: loc.isActive,
        workingCalendarId: loc.workingCalendarId ?? null,
        address: {
          line1: loc.line1,
          line2: loc.line2 ?? undefined,
          city: loc.city,
          state: loc.state,
          postalCode: loc.postalCode,
          country: loc.country,
        },
      });
    }

    this.calendars.list().subscribe({
      next: (list) => this.calendarOptions.set([
        this.defaultCalendarOption(),
        ...list
          .filter(c => c.isActive || c.id === this.form.controls.workingCalendarId.value)
          .map(c => ({ value: c.id, label: `${c.name} (${c.timeZone})` })),
      ]),
    });
  }

  protected save(): void {
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const addr = v.address;

    this.dialogRef.clearDraft();
    this.saved.emit({
      name: v.name!,
      phone: v.phone || null,
      isActive: v.isActive!,
      line1: addr?.line1 ?? '',
      line2: addr?.line2 ?? null,
      city: addr?.city ?? '',
      state: addr?.state ?? '',
      postalCode: addr?.postalCode ?? '',
      country: addr?.country ?? 'US',
      workingCalendarId: v.workingCalendarId ?? null,
    });
  }

  private defaultCalendarOption(): SelectOption {
    return { value: null, label: this.translate.instant('companyLocationDialog.defaultCalendar') };
  }
}
