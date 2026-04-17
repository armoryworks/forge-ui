import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AnnouncementService } from '../../../../shared/services/announcement.service';
import { AnnouncementTemplate, AnnouncementSeverity, AnnouncementScope } from '../../../../shared/models/announcement.model';
import { AdminService } from '../../../admin/services/admin.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-create-announcement-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    ToggleComponent,
    DatepickerComponent,
    ValidationPopoverDirective,
    TranslatePipe,
  ],
  templateUrl: './create-announcement-dialog.component.html',
  styleUrl: './create-announcement-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAnnouncementDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<CreateAnnouncementDialogComponent>);
  private readonly announcementService = inject(AnnouncementService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly saving = signal(false);
  protected readonly templates = signal<AnnouncementTemplate[]>([]);
  protected readonly teamOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    templateId: new FormControl<number | null>(null),
    title: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    content: new FormControl('', [Validators.required, Validators.maxLength(5000)]),
    severity: new FormControl<AnnouncementSeverity>('Info', [Validators.required]),
    scope: new FormControl<AnnouncementScope>('CompanyWide', [Validators.required]),
    requiresAcknowledgment: new FormControl(false),
    expiresAt: new FormControl<Date | null>(null),
    targetTeamIds: new FormControl<number[]>([]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    title: 'Title',
    content: 'Content',
    severity: 'Severity',
    scope: 'Scope',
  });

  protected readonly severityOptions: SelectOption[] = [
    { value: 'Info', label: 'Info' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Critical', label: 'Critical' },
  ];

  protected readonly scopeOptions: SelectOption[] = [
    { value: 'CompanyWide', label: 'Company-Wide' },
    { value: 'SelectedTeams', label: 'Selected Teams' },
    { value: 'IndividualTeam', label: 'Individual Team' },
    { value: 'TeamLeadsOnly', label: 'Team Leads Only' },
  ];

  protected readonly templateOptions = signal<SelectOption[]>([]);

  protected readonly showTeamSelector = signal(false);

  constructor() {
    this.form.controls.scope.valueChanges.subscribe(scope => {
      this.showTeamSelector.set(scope === 'SelectedTeams' || scope === 'IndividualTeam');
    });
  }

  ngOnInit(): void {
    this.announcementService.getTemplates().subscribe(templates => {
      this.templates.set(templates);
      this.templateOptions.set([
        { value: null, label: '-- None --' },
        ...templates.map(t => ({ value: t.id, label: t.name })),
      ]);
    });

    this.adminService.getTeams().subscribe(teams => {
      this.teamOptions.set(teams.map(t => ({ value: t.id, label: t.name })));
    });

    this.form.controls.templateId.valueChanges.subscribe(templateId => {
      if (!templateId) return;
      const template = this.templates().find(t => t.id === templateId);
      if (template) {
        this.form.patchValue({
          content: template.content,
          severity: template.defaultSeverity,
          scope: template.defaultScope,
          requiresAcknowledgment: template.defaultRequiresAcknowledgment,
        });
      }
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const v = this.form.getRawValue();

    this.announcementService.create({
      title: v.title!,
      content: v.content!,
      severity: v.severity!,
      scope: v.scope!,
      requiresAcknowledgment: v.requiresAcknowledgment ?? false,
      expiresAt: v.expiresAt ? toIsoDate(v.expiresAt) : undefined,
      targetTeamIds: v.targetTeamIds ?? [],
      templateId: v.templateId ?? undefined,
    }).subscribe({
      next: (announcement) => {
        this.saving.set(false);
        this.snackbar.success('Announcement sent');
        this.dialogRef.close(announcement);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
