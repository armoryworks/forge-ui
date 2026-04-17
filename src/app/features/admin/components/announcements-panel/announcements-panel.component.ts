import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { AnnouncementService } from '../../../../shared/services/announcement.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { Announcement, AnnouncementAcknowledgment, AnnouncementTemplate, CreateAnnouncementTemplateRequest } from '../../../../shared/models/announcement.model';
import { CreateAnnouncementDialogComponent } from '../../../chat/components/create-announcement-dialog/create-announcement-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-announcements-panel',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DataTableComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
    SelectComponent,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    ToggleComponent,
    ValidationPopoverDirective,
    TranslatePipe,
  ],
  templateUrl: './announcements-panel.component.html',
  styleUrl: './announcements-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsPanelComponent implements OnInit {
  private readonly announcementService = inject(AnnouncementService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  protected readonly isLoading = signal(false);
  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly templates = signal<AnnouncementTemplate[]>([]);
  protected readonly selectedAnnouncement = signal<Announcement | null>(null);
  protected readonly acknowledgments = signal<AnnouncementAcknowledgment[]>([]);
  protected readonly showAckDialog = signal(false);
  protected readonly showTemplateDialog = signal(false);
  protected readonly savingTemplate = signal(false);
  protected readonly activeView = signal<'announcements' | 'templates'>('announcements');

  protected readonly severityFilter = new FormControl<string>('');

  protected readonly severityFilterOptions: SelectOption[] = [
    { value: '', label: 'All' },
    { value: 'Critical', label: 'Critical' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Info', label: 'Info' },
  ];

  protected readonly announcementColumns: ColumnDef[] = [
    { field: 'title', header: 'Title', sortable: true },
    { field: 'severity', header: 'Severity', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'Critical', label: 'Critical' },
        { value: 'Warning', label: 'Warning' },
        { value: 'Info', label: 'Info' },
      ] },
    { field: 'scope', header: 'Scope', sortable: true, width: '140px' },
    { field: 'createdByName', header: 'Sent By', sortable: true, width: '140px' },
    { field: 'createdAt', header: 'Sent', sortable: true, type: 'date', width: '140px' },
    { field: 'acknowledgmentCount', header: 'Acks', sortable: true, type: 'number', width: '80px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly templateColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'defaultSeverity', header: 'Severity', sortable: true, width: '100px' },
    { field: 'defaultScope', header: 'Scope', sortable: true, width: '140px' },
    { field: 'defaultRequiresAcknowledgment', header: 'Ack Required', width: '110px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly templateForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    content: new FormControl('', [Validators.required, Validators.maxLength(5000)]),
    defaultSeverity: new FormControl('Info', [Validators.required]),
    defaultScope: new FormControl('CompanyWide', [Validators.required]),
    defaultRequiresAcknowledgment: new FormControl(false),
  });

  protected readonly templateViolations = FormValidationService.getViolations(this.templateForm, {
    name: 'Name',
    content: 'Content',
    defaultSeverity: 'Default Severity',
    defaultScope: 'Default Scope',
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

  ngOnInit(): void {
    this.loadAnnouncements();
    this.loadTemplates();
  }

  protected loadAnnouncements(): void {
    this.isLoading.set(true);
    this.announcementService.getAll().subscribe({
      next: (data) => {
        this.announcements.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected loadTemplates(): void {
    this.announcementService.getTemplates().subscribe({
      next: (data) => this.templates.set(data),
    });
  }

  protected openCreateAnnouncement(): void {
    this.dialog.open(CreateAnnouncementDialogComponent, {
      width: '520px',
    }).afterClosed().subscribe(result => {
      if (result) this.loadAnnouncements();
    });
  }

  protected viewAcknowledgments(announcement: Announcement): void {
    this.selectedAnnouncement.set(announcement);
    this.acknowledgments.set([]);
    this.showAckDialog.set(true);
    this.announcementService.getAcknowledgments(announcement.id).subscribe({
      next: (acks) => this.acknowledgments.set(acks),
    });
  }

  protected closeAckDialog(): void {
    this.showAckDialog.set(false);
    this.selectedAnnouncement.set(null);
  }

  protected openCreateTemplate(): void {
    this.templateForm.reset({
      defaultSeverity: 'Info',
      defaultScope: 'CompanyWide',
      defaultRequiresAcknowledgment: false,
    });
    this.showTemplateDialog.set(true);
  }

  protected closeTemplateDialog(): void {
    this.showTemplateDialog.set(false);
  }

  protected saveTemplate(): void {
    if (this.templateForm.invalid || this.savingTemplate()) return;
    this.savingTemplate.set(true);
    const v = this.templateForm.getRawValue();
    const request: CreateAnnouncementTemplateRequest = {
      name: v.name!,
      content: v.content!,
      defaultSeverity: v.defaultSeverity as CreateAnnouncementTemplateRequest['defaultSeverity'],
      defaultScope: v.defaultScope as CreateAnnouncementTemplateRequest['defaultScope'],
      defaultRequiresAcknowledgment: v.defaultRequiresAcknowledgment ?? false,
    };
    this.announcementService.createTemplate(request).subscribe({
      next: () => {
        this.savingTemplate.set(false);
        this.closeTemplateDialog();
        this.loadTemplates();
        this.snackbar.success('Template created');
      },
      error: () => this.savingTemplate.set(false),
    });
  }

  protected deleteTemplate(template: AnnouncementTemplate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Template?',
        message: `Delete template "${template.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.announcementService.deleteTemplate(template.id).subscribe({
        next: () => {
          this.loadTemplates();
          this.snackbar.success('Template deleted');
        },
      });
    });
  }

  protected severityChipClass(severity: string): string {
    switch (severity) {
      case 'Critical': return 'chip chip--error';
      case 'Warning': return 'chip chip--warning';
      default: return 'chip chip--info';
    }
  }

  protected switchView(view: 'announcements' | 'templates'): void {
    this.activeView.set(view);
  }
}
