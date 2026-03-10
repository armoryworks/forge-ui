import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { AdminService } from './services/admin.service';
import { AdminUser } from './models/admin-user.model';
import { SystemSetting } from './models/system-setting.model';
import { StageRequest } from './models/stage-request.model';
import { ReferenceDataGroup } from './models/reference-data-group.model';
import { TerminologyEntryItem } from './models/terminology-entry-item.model';
import { TrackType } from '../../shared/models/track-type.model';
import { TrackTypeDialogComponent } from './components/track-type-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TerminologyService } from '../../shared/services/terminology.service';
import { ThemeService } from '../../shared/services/theme.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule, AvatarComponent, PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, ToggleComponent, DataTableComponent,
    ColumnCellDirective, ValidationPopoverDirective, TrackTypeDialogComponent,
    EmptyStateComponent, LoadingBlockDirective,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly terminologyService = inject(TerminologyService);
  private readonly themeService = inject(ThemeService);

  protected readonly activeTab = signal<'users' | 'track-types' | 'reference-data' | 'terminology' | 'settings'>('users');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  // Users
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly showUserDialog = signal(false);
  protected readonly editingUser = signal<AdminUser | null>(null);

  protected readonly userForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    initials: new FormControl('', [Validators.maxLength(3)]),
    role: new FormControl('Engineer', [Validators.required]),
    isActive: new FormControl(true),
  });
  protected readonly userViolations = FormValidationService.getViolations(this.userForm, {
    firstName: 'First Name', lastName: 'Last Name', email: 'Email',
    password: 'Password', initials: 'Initials', role: 'Role',
  });

  protected readonly avatarColor = signal('#0d9488');

  // Track Types
  protected readonly trackTypes = signal<TrackType[]>([]);
  protected readonly expandedTrackType = signal<number | null>(null);
  protected readonly showTrackTypeDialog = signal(false);
  protected readonly editingTrackType = signal<TrackType | null>(null);

  // Reference Data
  protected readonly referenceDataGroups = signal<ReferenceDataGroup[]>([]);
  protected readonly expandedGroup = signal<string | null>(null);

  // Terminology
  protected readonly terminologyEntries = signal<TerminologyEntryItem[]>([]);
  protected readonly terminologyEdits = signal<Map<string, string>>(new Map());

  // System Settings
  protected readonly systemSettings = signal<SystemSetting[]>([]);
  protected readonly settingsEdits = signal<Map<string, string>>(new Map());

  // Logo
  protected readonly logoPreviewUrl = computed(() => this.themeService.logoUrl());

  protected readonly settingDefinitions: { key: string; label: string; description: string; type: 'text' | 'number' | 'boolean' }[] = [
    { key: 'app.name', label: 'Application Name', description: 'Name displayed in the header and browser tab', type: 'text' },
    { key: 'app.company_name', label: 'Company Name', description: 'Your company name for documents and invoices', type: 'text' },
    { key: 'planning.cycle_duration_days', label: 'Planning Cycle (Days)', description: 'Default planning cycle length in days', type: 'number' },
    { key: 'planning.nudge_hour', label: 'Daily Nudge Hour (24h)', description: 'Hour of day for daily planning nudge (0-23)', type: 'number' },
    { key: 'files.max_upload_size_mb', label: 'Max Upload Size (MB)', description: 'Maximum file upload size in megabytes', type: 'number' },
    { key: 'jobs.default_priority', label: 'Default Job Priority', description: 'Default priority for new jobs (Low, Normal, High, Urgent)', type: 'text' },
    { key: 'jobs.auto_archive_days', label: 'Auto-Archive After (Days)', description: 'Days after completion before auto-archiving jobs (0 = disabled)', type: 'number' },
    { key: 'notifications.email_enabled', label: 'Email Notifications', description: 'Enable email notifications for mentions and assignments', type: 'boolean' },
    { key: 'theme.primary_color', label: 'Primary Brand Color', description: 'Primary theme color (hex, e.g. #0d9488)', type: 'text' },
    { key: 'theme.accent_color', label: 'Accent Brand Color', description: 'Accent theme color (hex, e.g. #7c3aed)', type: 'text' },
  ];

  protected readonly userColumns: ColumnDef[] = [
    { field: 'avatar', header: '', width: '36px' },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'email', header: 'Email', sortable: true },
    { field: 'role', header: 'Role', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Admin', label: 'Admin' }, { value: 'Engineer', label: 'Engineer' }, { value: 'Viewer', label: 'Viewer' },
    ]},
    { field: 'status', header: 'Status', sortable: true },
    { field: 'actions', header: 'Actions', width: '80px', align: 'right' },
  ];

  protected readonly roleOptions: SelectOption[] = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Engineer', label: 'Engineer' },
    { value: 'Viewer', label: 'Viewer' },
  ];
  protected readonly avatarColors = [
    '#0d9488', '#7c3aed', '#c2410c', '#15803d', '#1d4ed8',
    '#be123c', '#92400e', '#6d28d9', '#065f46', '#1e40af',
  ];

  constructor() {
    this.loadUsers();
  }

  protected switchTab(tab: 'users' | 'track-types' | 'reference-data' | 'terminology' | 'settings'): void {
    this.activeTab.set(tab);
    if (tab === 'users' && this.users().length === 0) this.loadUsers();
    if (tab === 'track-types' && this.trackTypes().length === 0) this.loadTrackTypes();
    if (tab === 'reference-data' && this.referenceDataGroups().length === 0) this.loadReferenceData();
    if (tab === 'terminology' && this.terminologyEntries().length === 0) this.loadTerminology();
    if (tab === 'settings' && this.systemSettings().length === 0) this.loadSystemSettings();
  }

  // ── Users ──

  private loadUsers(): void {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: (users) => { this.users.set(users); this.loading.set(false); },
      error: (err) => { this.error.set('Failed to load users'); this.loading.set(false); },
    });
  }

  protected openCreateUser(): void {
    this.editingUser.set(null);
    this.userForm.reset({
      firstName: '', lastName: '', email: '', password: '',
      initials: '', role: 'Engineer', isActive: true,
    });
    this.userForm.controls.email.enable();
    this.userForm.controls.password.enable();
    this.avatarColor.set('#0d9488');
    this.showUserDialog.set(true);
  }

  protected openEditUser(user: AdminUser): void {
    this.editingUser.set(user);
    this.userForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      initials: user.initials ?? '',
      role: user.roles[0] ?? 'Engineer',
      isActive: user.isActive,
    });
    this.userForm.controls.email.disable();
    this.userForm.controls.password.disable();
    this.avatarColor.set(user.avatarColor ?? '#0d9488');
    this.showUserDialog.set(true);
  }

  protected closeUserDialog(): void {
    this.showUserDialog.set(false);
  }

  protected saveUser(): void {
    if (this.userForm.invalid) return;

    const form = this.userForm.getRawValue();
    const editing = this.editingUser();

    this.saving.set(true);

    if (editing) {
      this.adminService.updateUser(editing.id, {
        firstName: form.firstName!,
        lastName: form.lastName!,
        initials: form.initials || undefined,
        avatarColor: this.avatarColor(),
        isActive: form.isActive!,
        role: form.role!,
      }).subscribe({
        next: () => { this.saving.set(false); this.closeUserDialog(); this.loadUsers(); },
        error: (err) => { this.saving.set(false); this.error.set('Failed to update user'); },
      });
    } else {
      this.adminService.createUser({
        email: form.email!,
        firstName: form.firstName!,
        lastName: form.lastName!,
        initials: form.initials || undefined,
        avatarColor: this.avatarColor(),
        password: form.password!,
        role: form.role!,
      }).subscribe({
        next: () => { this.saving.set(false); this.closeUserDialog(); this.loadUsers(); },
        error: (err) => { this.saving.set(false); this.error.set('Failed to create user'); },
      });
    }
  }

  protected toggleUserActive(user: AdminUser): void {
    this.adminService.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: () => this.loadUsers(),
      error: () => this.error.set('Failed to update user status'),
    });
  }

  // ── Track Types ──

  private loadTrackTypes(): void {
    this.loading.set(true);
    this.adminService.getTrackTypes().subscribe({
      next: (types) => { this.trackTypes.set(types); this.loading.set(false); },
      error: () => { this.error.set('Failed to load track types'); this.loading.set(false); },
    });
  }

  protected toggleTrackType(id: number): void {
    this.expandedTrackType.set(this.expandedTrackType() === id ? null : id);
  }

  protected openCreateTrackType(): void {
    this.editingTrackType.set(null);
    this.showTrackTypeDialog.set(true);
  }

  protected openEditTrackType(tt: TrackType): void {
    this.editingTrackType.set(tt);
    this.showTrackTypeDialog.set(true);
  }

  protected closeTrackTypeDialog(): void {
    this.showTrackTypeDialog.set(false);
  }

  protected saveTrackType(data: { name: string; code: string; description: string | null; stages: StageRequest[] }): void {
    this.saving.set(true);
    const editing = this.editingTrackType();

    if (editing) {
      this.adminService.updateTrackType(editing.id, data).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeTrackTypeDialog();
          this.loadTrackTypes();
          this.snackbar.success('Track type updated');
        },
        error: () => { this.saving.set(false); this.snackbar.error('Failed to update track type'); },
      });
    } else {
      this.adminService.createTrackType(data).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeTrackTypeDialog();
          this.loadTrackTypes();
          this.snackbar.success('Track type created');
        },
        error: () => { this.saving.set(false); this.snackbar.error('Failed to create track type'); },
      });
    }
  }

  protected deleteTrackType(tt: TrackType): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Track Type?',
        message: `This will deactivate "${tt.name}" and all its stages. Existing jobs will remain.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.deleteTrackType(tt.id).subscribe({
        next: () => {
          this.loadTrackTypes();
          this.snackbar.success('Track type deleted');
        },
        error: () => this.snackbar.error('Failed to delete track type'),
      });
    });
  }

  // ── Reference Data ──

  private loadReferenceData(): void {
    this.loading.set(true);
    this.adminService.getReferenceData().subscribe({
      next: (groups) => { this.referenceDataGroups.set(groups); this.loading.set(false); },
      error: () => { this.error.set('Failed to load reference data'); this.loading.set(false); },
    });
  }

  protected toggleGroup(groupCode: string): void {
    this.expandedGroup.set(this.expandedGroup() === groupCode ? null : groupCode);
  }

  protected formatGroupCode(code: string): string {
    return code.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // ── Terminology ──

  private loadTerminology(): void {
    this.loading.set(true);
    this.adminService.getTerminology().subscribe({
      next: (entries) => {
        this.terminologyEntries.set(entries);
        this.terminologyEdits.set(new Map(entries.map(e => [e.key, e.label])));
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load terminology'); this.loading.set(false); },
    });
  }

  protected onTerminologyChange(key: string, label: string): void {
    this.terminologyEdits.update(map => {
      const updated = new Map(map);
      updated.set(key, label);
      return updated;
    });
    this.terminologyService.set(key, label);
  }

  protected hasTerminologyChanges(): boolean {
    const edits = this.terminologyEdits();
    return this.terminologyEntries().some(e => edits.get(e.key) !== e.label);
  }

  protected saveTerminology(): void {
    const entries = Array.from(this.terminologyEdits()).map(([key, label]) => ({ key, label }));
    this.saving.set(true);
    this.adminService.updateTerminology(entries).subscribe({
      next: (updated) => {
        this.terminologyEntries.set(updated);
        this.terminologyEdits.set(new Map(updated.map(e => [e.key, e.label])));
        this.saving.set(false);
        this.snackbar.success('Terminology saved');
      },
      error: () => { this.saving.set(false); this.snackbar.error('Failed to save terminology'); },
    });
  }

  protected getTerminologyDefault(key: string): string {
    return key
      .replace(/^(entity_|status_|action_|label_|field_)/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── System Settings ──

  private loadSystemSettings(): void {
    this.loading.set(true);
    this.adminService.getSystemSettings().subscribe({
      next: (settings) => {
        this.systemSettings.set(settings);
        this.settingsEdits.set(new Map(settings.map(s => [s.key, s.value])));
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load system settings'); this.loading.set(false); },
    });
  }

  protected onSettingChange(key: string, value: string): void {
    this.settingsEdits.update(map => {
      const updated = new Map(map);
      updated.set(key, value);
      return updated;
    });
  }

  protected getSettingValue(key: string): string {
    return this.settingsEdits().get(key) ?? '';
  }

  protected hasSettingsChanges(): boolean {
    const edits = this.settingsEdits();
    const current = new Map(this.systemSettings().map(s => [s.key, s.value]));
    for (const [key, value] of edits) {
      if (current.get(key) !== value) return true;
    }
    for (const def of this.settingDefinitions) {
      if (edits.has(def.key) && !current.has(def.key) && edits.get(def.key) !== '') return true;
    }
    return false;
  }

  protected saveSettings(): void {
    const edits = this.settingsEdits();
    const settings = this.settingDefinitions
      .filter(def => edits.has(def.key))
      .map(def => ({
        key: def.key,
        value: edits.get(def.key)!,
        description: def.description,
      }));

    this.saving.set(true);
    this.adminService.updateSystemSettings(settings).subscribe({
      next: (updated) => {
        this.systemSettings.set(updated);
        this.settingsEdits.set(new Map(updated.map(s => [s.key, s.value])));
        this.saving.set(false);
        this.snackbar.success('Settings saved');

        const lookup = new Map(updated.map(s => [s.key, s.value]));
        this.themeService.setBrandColors(
          lookup.get('theme.primary_color') || undefined,
          lookup.get('theme.accent_color') || undefined,
        );
      },
      error: () => { this.saving.set(false); this.snackbar.error('Failed to save settings'); },
    });
  }

  // ── Logo ──

  protected onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.saving.set(true);
    this.adminService.uploadLogo(file).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Logo uploaded');
        this.themeService.loadBrandSettings();
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error('Failed to upload logo');
      },
    });
  }

  protected removeLogo(): void {
    this.saving.set(true);
    this.adminService.deleteLogo().subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success('Logo removed');
        this.themeService.loadBrandSettings();
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error('Failed to remove logo');
      },
    });
  }
}
