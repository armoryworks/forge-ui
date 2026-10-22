import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

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
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { Announcement, AnnouncementAcknowledgment, AnnouncementTemplate, CreateAnnouncementTemplateRequest } from '../../../../shared/models/announcement.model';
import { CreateAnnouncementDialogComponent } from '../../../chat/components/create-announcement-dialog/create-announcement-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabListDirective, TabDirective } from '../../../../shared/directives/tab-list.directive';
import { ScrollCueDirective } from '../../../../shared/directives/scroll-cue.directive';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';

@Component({
  selector: 'app-announcements-panel',
  standalone: true,
  imports: [
    TabListDirective,
    TabDirective,
    ScrollCueDirective,
    DateTimePipe,
    ReactiveFormsModule,
    DataTableComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
    SelectComponent,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    ToggleComponent,
    ValidationButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './announcements-panel.component.html',
  styleUrl: './announcements-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsPanelComponent implements OnInit {
  private readonly announcementService = inject(AnnouncementService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

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
    { field: 'title', header: 'common.title', sortable: true },
    { field: 'severity', header: 'columns.severity', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'Critical', label: 'Critical' },
        { value: 'Warning', label: 'Warning' },
        { value: 'Info', label: 'Info' },
      ] },
    { field: 'scope', header: 'columns.scope', sortable: true, width: '140px' },
    { field: 'createdByName', header: 'columns.sentBy', sortable: true, width: '140px' },
    { field: 'createdAt', header: 'columns.sent', sortable: true, type: 'date', width: '140px' },
    { field: 'acknowledgmentCount', header: 'columns.acknowledgements', sortable: true, type: 'number', width: '80px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly templateColumns: ColumnDef[] = [
    { field: 'name', header: 'common.name', sortable: true },
    { field: 'defaultSeverity', header: 'columns.severity', sortable: true, width: '100px' },
    { field: 'defaultScope', header: 'columns.scope', sortable: true, width: '140px' },
    { field: 'defaultRequiresAcknowledgment', header: 'columns.acknowledgementRequired', width: '110px' },
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
    // Subscribe to real-time announcement pushes BEFORE the initial fetch so we
    // don't miss any that arrive during the round-trip. Prepend incoming payloads
    // directly — no HTTP re-fetch needed.
    const unsubscribe = this.announcementService.onAnnouncementCreated((announcement) => {
      this.announcements.update(list =>
        list.some(a => a.id === announcement.id) ? list : [announcement, ...list]);
    });
    this.destroyRef.onDestroy(unsubscribe);

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
        this.snackbar.success(this.translate.instant('announcements.templateMessages.created'));
      },
      error: () => this.savingTemplate.set(false),
    });
  }

  protected deleteTemplate(template: AnnouncementTemplate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('announcements.templateMessages.deleteTitle'),
        message: this.translate.instant('announcements.templateMessages.deleteMessage', { name: template.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.announcementService.deleteTemplate(template.id).subscribe({
        next: () => {
          this.loadTemplates();
          this.snackbar.success(this.translate.instant('announcements.templateMessages.deleted'));
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
