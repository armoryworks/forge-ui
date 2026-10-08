import { DatePipe, LowerCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AdminService } from './services/admin.service';
import { AdminUser } from './models/admin-user.model';
import { ScanIdentifier } from './models/scan-identifier.model';
import { SystemSetting } from './models/system-setting.model';
import { StageRequest } from './models/stage-request.model';
import { ReferenceDataGroup } from './models/reference-data-group.model';
import { TerminologyEntryItem } from './models/terminology-entry-item.model';
import { NumberingSettingRow } from './models/numbering-setting-row.model';
import { NUMBERING_SETTING_LABELS } from './models/numbering-setting-labels.const';
import { SystemSettingDefinition } from './models/system-setting-definition.model';
import { SYSTEM_SETTING_DEFAULTS } from './models/system-setting-defaults.const';
import { AdminSettingsService } from './settings/services/admin-settings.service';
import { TrackType } from '../../shared/models/track-type.model';
import { TrackTypeDialogComponent } from './components/track-type-dialog.component';
import { AddDeviceDialogComponent } from './components/add-device-dialog/add-device-dialog.component';
import { TelemetryConsentDialogComponent } from './components/telemetry-consent-dialog/telemetry-consent-dialog.component';
import { TelemetryService } from './services/telemetry.service';
import { TelemetryAgreement, TelemetryConsentRecord, TelemetryStatus } from './models/telemetry.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { CapDirective } from '../../shared/directives/cap.directive';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TerminologyService } from '../../shared/services/terminology.service';
import { ThemeService } from '../../shared/services/theme.service';
import { BrandingService } from '../../shared/services/branding.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { AdminOverviewComponent } from './components/admin-overview/admin-overview.component';
import { TrainingPanelComponent } from './components/training-panel/training-panel.component';
import { IntegrationsPanelComponent } from './components/integrations-panel/integrations-panel.component';
import { BarcodeInfoComponent } from '../../shared/components/barcode-info/barcode-info.component';
import { ScannerService } from '../../shared/services/scanner.service';
import { WebHidRfidService } from '../../shared/services/web-hid-rfid.service';
import { AiAssistantsPanelComponent } from './components/ai-assistants-panel/ai-assistants-panel.component';
import { TeamsPanelComponent } from './components/teams-panel/teams-panel.component';
import { RoleTemplatesPanelComponent } from './components/role-templates-panel/role-templates-panel.component';
import { ComplianceTemplatesPanelComponent } from './components/compliance-templates-panel/compliance-templates-panel.component';
import { UserCompliancePanelComponent } from './components/user-compliance-panel/user-compliance-panel.component';
import { SalesTaxPanelComponent } from './components/sales-tax-panel/sales-tax-panel.component';
import { AuditLogPanelComponent } from './components/audit-log-panel/audit-log-panel.component';
import { TimeCorrectionsPanelComponent } from './components/time-corrections-panel/time-corrections-panel.component';
import { EventsPanelComponent } from './components/events-panel/events-panel.component';
import { EdiPanelComponent } from './components/edi-panel/edi-panel.component';
import { MfaPolicyPanelComponent } from './components/mfa-policy-panel/mfa-policy-panel.component';
import { DomainEventFailuresPanelComponent } from './components/domain-event-failures-panel/domain-event-failures-panel.component';
import { IntegrationOutboxPanelComponent } from './components/integration-outbox-panel/integration-outbox-panel.component';
import { AutoPoSettingsComponent } from './components/auto-po-settings/auto-po-settings.component';
import { ExpenseSettingsPanelComponent } from './components/expense-settings-panel/expense-settings-panel.component';
import { AnnouncementsPanelComponent } from './components/announcements-panel/announcements-panel.component';
import { BiApiKeysPanelComponent } from './components/bi-api-keys-panel/bi-api-keys-panel.component';
import { SystemApiKeysPanelComponent } from './components/system-api-keys-panel/system-api-keys-panel.component';
import { ConnectionsPanelComponent } from './components/connections-panel/connections-panel.component';
import { CompanyLocationDialogComponent } from './components/company-location-dialog/company-location-dialog.component';
import { AuthService } from '../../shared/services/auth.service';
import { ReferenceDataService } from '../../shared/services/reference-data.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { CompanyLocation, CompanyProfile } from './models/company-location.model';
import { SlideoutComponent } from '../../shared/components/slideout/slideout.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule, AvatarComponent, PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, ToggleComponent, DatepickerComponent, DataTableComponent,
    ColumnCellDirective, ValidationButtonComponent, TrackTypeDialogComponent,
    EmptyStateComponent, LoadingBlockDirective, AdminOverviewComponent, TrainingPanelComponent, IntegrationsPanelComponent, AiAssistantsPanelComponent, TeamsPanelComponent, RoleTemplatesPanelComponent, ComplianceTemplatesPanelComponent, UserCompliancePanelComponent, CompanyLocationDialogComponent, SalesTaxPanelComponent, AuditLogPanelComponent, TimeCorrectionsPanelComponent, EventsPanelComponent, AnnouncementsPanelComponent, EdiPanelComponent, MfaPolicyPanelComponent, DomainEventFailuresPanelComponent, IntegrationOutboxPanelComponent, AutoPoSettingsComponent, ExpenseSettingsPanelComponent, BiApiKeysPanelComponent, SystemApiKeysPanelComponent, ConnectionsPanelComponent, BarcodeInfoComponent, SlideoutComponent, DatePipe, LowerCasePipe, TranslatePipe, MatTooltipModule, AddDeviceDialogComponent, CapDirective, TelemetryConsentDialogComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly terminologyService = inject(TerminologyService);
  private readonly themeService = inject(ThemeService);
  private readonly branding = inject(BrandingService);
  private readonly scanner = inject(ScannerService);
  protected readonly rfid = inject(WebHidRfidService);
  private readonly authService = inject(AuthService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly draftResume = inject(DraftResumeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly adminSettings = inject(AdminSettingsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private static readonly VALID_TABS = new Set(['overview', 'users', 'track-types', 'reference-data', 'settings', 'integrations', 'training', 'ai-assistants', 'teams', 'role-templates', 'compliance', 'sales-tax', 'audit-log', 'time-corrections', 'events', 'announcements', 'edi', 'mfa', 'automations', 'auto-po', 'integration-outbox', 'expenses', 'bi-api-keys', 'system-api-keys', 'connections']);
  private static readonly ADMIN_ONLY_TABS = new Set(['overview', 'users', 'track-types', 'reference-data', 'settings', 'integrations', 'ai-assistants', 'teams', 'role-templates', 'sales-tax', 'audit-log', 'edi', 'mfa', 'automations', 'auto-po', 'integration-outbox', 'expenses', 'bi-api-keys', 'system-api-keys', 'connections']);
  private static readonly MANAGER_AND_ADMIN_TABS = new Set(['training', 'time-corrections', 'events', 'announcements']);

  protected readonly isAdmin = computed(() => this.authService.hasRole('Admin'));
  protected readonly isManagerOrAdmin = computed(() => this.authService.hasRole('Admin') || this.authService.hasRole('Manager'));
  protected readonly pageTitle = computed(() => this.isAdmin() ? this.translate.instant('admin.title') : this.translate.instant('admin.titleEmployee'));
  protected readonly pageSubtitle = computed(() => this.isAdmin() ? this.translate.instant('admin.subtitle') : this.translate.instant('admin.subtitleEmployee'));

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map(params => {
        const isAdmin = this.authService.hasRole('Admin');
        const isManager = this.authService.hasRole('Manager');
        // Admins land on the new Overview dashboard (replaces the prior
        // bare-`/admin` → `/admin/users` redirect). Non-admin managers /
        // office managers continue to land on Compliance because Overview
        // is admin-gated and the rest of the admin shell only has a couple
        // of tabs available to them.
        const defaultTab = isAdmin ? 'overview' : 'compliance';
        const tab = params.get('tab') ?? defaultTab;
        if (!AdminComponent.VALID_TABS.has(tab)) return defaultTab;
        if (AdminComponent.ADMIN_ONLY_TABS.has(tab) && !isAdmin) return 'compliance';
        if (AdminComponent.MANAGER_AND_ADMIN_TABS.has(tab) && !isAdmin && !isManager) return 'compliance';
        return tab;
      }),
    ),
    { initialValue: this.authService.hasRole('Admin') ? 'overview' : 'compliance' },
  );
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  // Users
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly showUserDialog = signal(false);
  protected readonly editingUser = signal<AdminUser | null>(null);
  protected readonly deviceUser = signal<AdminUser | null>(null);
  protected readonly sharedDeviceOpen = signal(false);

  protected readonly userForm = new FormGroup({
    firstName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    lastName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(256)]),
    initials: new FormControl('', [Validators.maxLength(3)]),
    roles: new FormControl<string[]>(['Engineer'], [Validators.required]),
    workLocationId: new FormControl<number | null>(null),
    isActive: new FormControl(true),
  });
  protected readonly userViolations = FormValidationService.getViolations(this.userForm, {
    firstName: 'First Name', lastName: 'Last Name', email: 'Email',
    initials: 'Initials', roles: 'Roles',
  });

  // Info-icon slideout: suggested role combinations (guidance only).
  protected readonly showRoleSuggestions = signal(false);
  protected readonly roleSuggestions: { labelKey: string; roles: string[] }[] = [
    { labelKey: 'admin.roleSuggestions.ownerOperator', roles: ['Admin', 'Manager', 'Controller'] },
    { labelKey: 'admin.roleSuggestions.frontOffice', roles: ['OfficeManager', 'Controller', 'IT Admin'] },
    { labelKey: 'admin.roleSuggestions.floorLead', roles: ['PM', 'Production Manager', 'Production Planner'] },
    { labelKey: 'admin.roleSuggestions.complianceOfficer', roles: ['ComplianceOfficer'] },
  ];

  protected toggleRoleSuggestions(): void {
    this.showRoleSuggestions.update(v => !v);
  }

  protected applyRoleSuggestion(roles: string[]): void {
    const current = this.userForm.controls.roles.value ?? [];
    const merged = Array.from(new Set([...current, ...roles]));
    this.userForm.controls.roles.setValue(merged);
    this.userForm.controls.roles.markAsDirty();
  }

  // Setup token shown after creating a user (so admin can share it)
  protected readonly setupToken = signal<string | null>(null);
  protected readonly setupTokenExpiresAt = signal<string | null>(null);

  protected readonly avatarColor = signal('#0d9488');

  // Scan Identifiers (shown when editing a user)
  protected readonly scanIdentifiers = signal<ScanIdentifier[]>([]);
  protected readonly scanIdLoading = signal(false);
  protected readonly newScanType = new FormControl('rfid');
  protected readonly newScanValue = new FormControl('');
  protected readonly scanTypeOptions: SelectOption[] = [
    { value: 'rfid', label: 'RFID Card' },
    { value: 'nfc', label: 'NFC Tag' },
    { value: 'barcode', label: 'Barcode' },
    { value: 'biometric', label: 'Biometric' },
  ];

  // Compliance — selected user for per-user detail panel
  protected readonly complianceUserControl = new FormControl<number | null>(null);
  protected readonly complianceUserId = toSignal(this.complianceUserControl.valueChanges, { initialValue: null });
  protected readonly complianceUserOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('admin.selectUserPlaceholder') },
    ...this.users().map(u => ({ value: u.id, label: `${u.lastName}, ${u.firstName}` })),
  ]);

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
  private readonly settingsLoaded = signal(false);
  protected readonly systemSettings = signal<SystemSetting[]>([]);
  protected readonly settingsEdits = signal<Map<string, string>>(new Map());
  private readonly numberingLoaded = signal(false);
  protected readonly numberingRows = signal<NumberingSettingRow[]>([]);
  protected readonly highlightedSetting = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('highlight'))),
    { initialValue: null },
  );

  // Company Profile
  private readonly profileLoaded = signal(false);
  protected readonly companyProfile = signal<CompanyProfile | null>(null);
  protected readonly profileForm = new FormGroup({
    name: new FormControl(''),
    phone: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    ein: new FormControl(''),
    website: new FormControl(''),
  });
  protected readonly profileSaving = signal(false);

  // Company Locations
  private readonly locationsLoaded = signal(false);
  protected readonly companyLocations = signal<CompanyLocation[]>([]);
  protected readonly showLocationDialog = signal(false);
  protected readonly editingLocation = signal<CompanyLocation | null>(null);
  protected readonly locationColumns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('admin.colName'), sortable: true },
    { field: 'address', header: this.translate.instant('admin.colAddress'), sortable: true, sortField: 'line1' },
    { field: 'state', header: this.translate.instant('admin.colState'), sortable: true, width: '80px' },
    { field: 'phone', header: this.translate.instant('admin.colPhone'), width: '140px' },
    { field: 'default', header: this.translate.instant('admin.colDefault'), width: '80px', align: 'center' },
    { field: 'actions', header: this.translate.instant('admin.colActions'), width: '120px', align: 'right' },
  ];
  protected readonly locationOptions = computed<SelectOption[]>(() => [
    { value: null, label: '-- Default --' },
    ...this.companyLocations().filter(l => l.isActive).map(l => ({ value: l.id, label: l.name })),
  ]);

  // Pay Period Locking
  protected readonly lockThroughControl = new FormControl<Date | null>(null);
  protected readonly lockingPeriod = signal(false);

  // Logo
  protected readonly logoPreviewUrl = computed(() => this.themeService.logoUrl());

  // Brand lockups — preview URLs re-resolve when theme flips or after upload/reset.
  protected readonly lockupRows = computed(() => [
    {
      kind: 'marquee',
      label: 'admin.lockupMarquee',
      hint: 'admin.lockupMarqueeHint',
      previewUrl: this.branding.marqueeUrl(),
      darkPreview: true,
    },
    {
      kind: 'wordmark',
      label: 'admin.lockupWordmark',
      hint: 'admin.lockupWordmarkHint',
      previewUrl: this.branding.wordmarkUrl(),
      darkPreview: true,
    },
    {
      kind: 'favicon',
      label: 'admin.lockupFavicon',
      hint: 'admin.lockupFaviconHint',
      previewUrl: this.branding.faviconUrl(),
      darkPreview: false,
    },
  ]);

  protected readonly settingDefinitions: SystemSettingDefinition[] = [
    { key: 'app.name', labelKey: 'capabilityAreas.systemSettings.appName', descKey: 'capabilityAreas.systemSettings.appNameDesc', type: 'text' },
    { key: 'planning.cycle_duration_days', labelKey: 'capabilityAreas.systemSettings.cycleDays', descKey: 'capabilityAreas.systemSettings.cycleDaysDesc', type: 'number' },
    { key: 'planning.nudge_hour', labelKey: 'capabilityAreas.systemSettings.nudgeHour', descKey: 'capabilityAreas.systemSettings.nudgeHourDesc', type: 'number' },
    { key: 'files.max_upload_size_mb', labelKey: 'capabilityAreas.systemSettings.maxUpload', descKey: 'capabilityAreas.systemSettings.maxUploadDesc', type: 'number' },
    { key: 'jobs.default_priority', labelKey: 'capabilityAreas.systemSettings.defaultPriority', descKey: 'capabilityAreas.systemSettings.defaultPriorityDesc', type: 'priority' },
    { key: 'jobs.auto_archive_days', labelKey: 'capabilityAreas.systemSettings.autoArchive', descKey: 'capabilityAreas.systemSettings.autoArchiveDesc', type: 'number' },
    { key: 'notifications.email_enabled', labelKey: 'capabilityAreas.systemSettings.emailNotifications', descKey: 'capabilityAreas.systemSettings.emailNotificationsDesc', type: 'boolean' },
    { key: 'theme.primary_color', labelKey: 'capabilityAreas.systemSettings.primaryColor', descKey: 'capabilityAreas.systemSettings.primaryColorDesc', type: 'color' },
    { key: 'theme.accent_color', labelKey: 'capabilityAreas.systemSettings.accentColor', descKey: 'capabilityAreas.systemSettings.accentColorDesc', type: 'color' },
  ];
  protected readonly settingDefaults = SYSTEM_SETTING_DEFAULTS;
  protected readonly settingControls: Record<string, FormControl<string>> = Object.fromEntries(
    this.settingDefinitions.map(def => [def.key, new FormControl('', { nonNullable: true, validators: AdminComponent.settingValidators(def) })]),
  );
  protected readonly invalidSettings = signal<ReadonlySet<string>>(new Set());
  protected readonly priorityOptions: SelectOption[] = ['Low', 'Normal', 'High', 'Urgent']
    .map(value => ({ value, label: this.translate.instant(`priority.${value.toLowerCase()}`) }));
  protected readonly booleanOptions: SelectOption[] = [
    { value: 'true', label: this.translate.instant('common.enabled') },
    { value: 'false', label: this.translate.instant('common.disabled') },
  ];

  protected readonly roleOptions = signal<SelectOption[]>([]);

  protected readonly userColumns = computed<ColumnDef[]>(() => [
    { field: 'avatar', header: '', width: '36px' },
    { field: 'name', header: this.translate.instant('admin.colName'), sortable: true, sortField: 'lastName' },
    { field: 'email', header: this.translate.instant('admin.colEmail'), sortable: true },
    { field: 'role', header: this.translate.instant('admin.colRole'), sortable: true, filterable: true, type: 'enum' as const,
      filterOptions: this.roleOptions(),
      sortValue: (row) => (row as AdminUser).roles[0] ?? '' },
    { field: 'workLocationName', header: this.translate.instant('admin.colLocation'), sortable: true, filterable: true, type: 'text' as const, width: '150px' },
    { field: 'compliance', header: this.translate.instant('admin.colCompliance'), sortable: true, width: '130px',
      sortValue: (row) => {
        const u = row as AdminUser;
        return u.complianceTotalItems > 0 ? u.complianceCompletedItems / u.complianceTotalItems : 1;
      } },
    { field: 'status', header: this.translate.instant('admin.colStatus'), sortable: true,
      sortValue: (row) => {
        const u = row as AdminUser;
        if (!u.hasPassword) return 0; // Pending Setup
        return u.isActive ? 2 : 1;    // Inactive < Active
      } },
    { field: 'actions', header: this.translate.instant('admin.colActions'), width: '140px', align: 'right' },
  ]);
  protected readonly avatarColors = [
    '#0d9488', '#7c3aed', '#c2410c', '#15803d', '#1d4ed8',
    '#be123c', '#92400e', '#6d28d9', '#065f46', '#1e40af',
  ];

  constructor() {
    // Load roles from API (used by user form select + column filter)
    this.refDataService.getRolesAsOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(opts => this.roleOptions.set(opts));

    for (const def of this.settingDefinitions) {
      this.settingControls[def.key].valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(value => this.onSettingChange(def.key, value));
    }

    effect(() => {
      const tab = this.activeTab();
      if (tab === 'users' && this.users().length === 0) this.loadUsers();
      if (tab === 'users' && !this.locationsLoaded()) this.loadCompanyLocations();
      if (tab === 'track-types' && this.trackTypes().length === 0) this.loadTrackTypes();
      if (tab === 'reference-data' && this.referenceDataGroups().length === 0) this.loadReferenceData();
      if (tab === 'terminology' && this.terminologyEntries().length === 0) this.loadTerminology();
      if (tab === 'settings' && !this.settingsLoaded()) this.loadSystemSettings();
      if (tab === 'settings' && !this.numberingLoaded()) this.loadNumberingSettings();
      if (tab === 'settings' && !this.profileLoaded()) this.loadCompanyProfile();
      if (tab === 'settings' && !this.locationsLoaded()) this.loadCompanyLocations();
      if (tab === 'settings' && this.telemetryStatus() === null) this.loadTelemetry();
      if (tab === 'compliance' && this.users().length === 0) this.loadUsers();
    });

    // When editing a user, ensure scanner is active and set context.
    // Also probe the relay so the "not installed" banner appears immediately.
    effect(() => {
      if (this.editingUser() !== null) {
        this.scanner.setContext('global');
        // Ensure the scanner keydown listener is registered (guards against
        // timing issues where the auth effect may not have started it yet)
        this.scanner.start();
        this.rfid.probeRelay();
      }
    });

    // When editing a user and a keyboard-wedge scan is detected, populate the scan value field
    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || !this.editingUser()) return;
      this.scanner.clearLastScan();
      this.newScanValue.setValue(scan.value);
      this.snackbar.success(this.translate.instant('admin.scanned', { value: scan.value }));
    });

    // When editing a user and an RFID card is tapped via WebHID, auto-add as scan identifier
    effect(() => {
      const scan = this.rfid.lastScan();
      const user = this.editingUser();
      if (!scan || !user) return;
      this.rfid.clearLastScan();
      this.newScanType.setValue('rfid');
      this.newScanValue.setValue(scan.uid);
      // Auto-add the scan identifier immediately
      this.addScanIdentifier();
    });

    // Auto-reconnect to a previously paired RFID reader
    this.rfid.reconnect();
  }

  ngOnInit(): void {
    // Draft-recovery "Go to" hint: reopen the matching create dialog. activeTab
    // already derives from ?tab=, so the relevant tab's section is rendered.
    if (this.draftResume.consume('company-location')) {
      this.openCreateLocation();
    } else if (this.draftResume.consume('track-type')) {
      this.openCreateTrackType();
    }
  }

  protected switchTab(tab: string): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  // ── Users ──

  private loadUsers(): void {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: (users) => { this.users.set(users); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('admin.loadUsersFailed')); this.loading.set(false); },
    });
  }

  protected openCreateUser(): void {
    this.editingUser.set(null);
    this.setupToken.set(null);
    this.setupTokenExpiresAt.set(null);
    this.userForm.reset({
      firstName: '', lastName: '', email: '',
      initials: '', roles: ['Engineer'], isActive: true,
    });
    this.showRoleSuggestions.set(false);
    this.userForm.controls.email.enable();
    this.avatarColor.set('#0d9488');
    this.showUserDialog.set(true);
  }

  protected openEditUser(user: AdminUser): void {
    this.editingUser.set(user);
    this.setupToken.set(null);
    this.setupTokenExpiresAt.set(null);
    this.userForm.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      initials: user.initials ?? '',
      roles: user.roles.length ? [...user.roles] : ['Engineer'],
      workLocationId: user.workLocationId ?? null,
      isActive: user.isActive,
    });
    this.showRoleSuggestions.set(false);
    // Email is editable in edit mode so admins can correct a typo'd address
    // (it has no other write path — previously only fixable via direct DB edit).
    this.userForm.controls.email.enable();
    this.avatarColor.set(user.avatarColor ?? '#0d9488');
    this.scanIdentifiers.set([]);
    this.newScanValue.reset();
    this.loadScanIdentifiers(user.id);
    this.showUserDialog.set(true);
  }

  protected closeUserDialog(): void {
    this.showUserDialog.set(false);
    this.scanIdentifiers.set([]);
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
        roles: form.roles ?? [],
        email: form.email !== editing.email ? form.email! : undefined,
      }).subscribe({
        next: () => {
          // Update work location if changed
          const newLocId = form.workLocationId ?? null;

          const finalize = () => {
            this.saving.set(false); this.closeUserDialog(); this.loadUsers();
          };

          if (newLocId !== editing.workLocationId) {
            this.adminService.updateUserWorkLocation(editing.id, newLocId).subscribe({
              next: finalize,
              error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.userSavedLocationFailed')); this.closeUserDialog(); this.loadUsers(); },
            });
          } else {
            finalize();
          }
        },
        error: () => { this.saving.set(false); this.error.set(this.translate.instant('admin.updateUserFailed')); },
      });
    } else {
      this.adminService.createUser({
        email: form.email!,
        firstName: form.firstName!,
        lastName: form.lastName!,
        initials: form.initials || undefined,
        avatarColor: this.avatarColor(),
        roles: form.roles ?? [],
      }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.loadUsers();

          // Transition into edit mode with the newly created user
          const newUser: AdminUser = {
            id: result.id,
            email: result.email,
            firstName: result.firstName,
            lastName: result.lastName,
            initials: result.initials,
            avatarColor: result.avatarColor,
            isActive: result.isActive,
            roles: result.roles,
            createdAt: result.createdAt,
            hasPassword: false,
            hasPendingSetupToken: true,
            hasRfidIdentifier: false,
            hasBarcodeIdentifier: false,
            canBeAssignedJobs: false,
            complianceCompletedItems: 0,
            complianceTotalItems: 8,
            missingComplianceItems: [],
            workLocationId: null,
            workLocationName: null,
            i9Status: null,
            isNonEmployee: false,
          };
          this.editingUser.set(newUser);
          this.setupToken.set(result.setupToken);
          this.setupTokenExpiresAt.set(result.setupTokenExpiresAt);
          this.userForm.controls.email.enable();
          this.loadScanIdentifiers(result.id);
          this.snackbar.success(this.translate.instant('admin.userCreated', { name: form.firstName }));
        },
        error: () => { this.saving.set(false); this.error.set(this.translate.instant('admin.createUserFailed')); },
      });
    }
  }

  protected async pairRfidReader(): Promise<void> {
    this.rfid.clearError();
    const success = await this.rfid.requestDevice();
    if (success) {
      this.snackbar.success(this.translate.instant('admin.rfidConnected', { device: this.rfid.deviceName() }));
    } else if (this.rfid.error() && this.rfid.error() !== 'rfid.relayNotInstalled') {
      this.snackbar.error(this.rfid.error()!);
    }
  }

  protected async unpairRfidReader(): Promise<void> {
    await this.rfid.disconnect();
    this.snackbar.info(this.translate.instant('admin.rfidDisconnected'));
  }

  protected readonly rfidInstallerDownloading = signal(false);

  protected downloadSetupScript(): void {
    const token = this.authService.token();
    if (!token) {
      this.snackbar.error(this.translate.instant('rfid.setupScriptError'));
      return;
    }

    // Direct navigation with token — avoids blob + programmatic click being blocked by strict browsers
    const url = `/api/v1/downloads/rfid-relay-setup.ps1?access_token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
  }

  protected copySetupCode(): void {
    const code = this.setupToken();
    if (!code) return;
    navigator.clipboard.writeText(code);
    this.snackbar.success(this.translate.instant('admin.setupCodeCopied'));
  }

  protected regenerateSetupToken(user: AdminUser): void {
    this.adminService.generateSetupToken(user.id).subscribe({
      next: (result) => {
        this.setupToken.set(result.token);
        this.setupTokenExpiresAt.set(result.expiresAt);
        this.snackbar.success(this.translate.instant('admin.setupTokenGenerated', { name: user.firstName }));
      },
      error: () => this.snackbar.error(this.translate.instant('admin.setupTokenFailed')),
    });
  }

  protected toggleUserActive(user: AdminUser): void {
    this.adminService.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: () => this.loadUsers(),
      error: () => this.error.set(this.translate.instant('admin.updateUserStatusFailed')),
    });
  }

  protected toggleNonEmployee(user: AdminUser): void {
    const turningOn = !user.isNonEmployee;
    if (!turningOn) {
      this.applyNonEmployee(user, false);
      return;
    }

    this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: this.translate.instant('admin.nonEmployee.confirmTitle'),
        message: this.translate.instant('admin.nonEmployee.confirmMessage'),
        confirmLabel: this.translate.instant('admin.nonEmployee.confirmAction'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (confirmed) this.applyNonEmployee(user, true);
    });
  }

  private applyNonEmployee(user: AdminUser, value: boolean): void {
    this.adminService.setUserNonEmployee(user.id, value).subscribe({
      next: () => this.loadUsers(),
      error: () => this.error.set(this.translate.instant('admin.nonEmployee.updateFailed')),
    });
  }

  // ── Scan Identifiers ──
  private loadScanIdentifiers(userId: number): void {
    this.scanIdLoading.set(true);
    this.adminService.getScanIdentifiers(userId).subscribe({
      next: (ids) => { this.scanIdentifiers.set(ids); this.scanIdLoading.set(false); },
      error: () => { this.scanIdentifiers.set([]); this.scanIdLoading.set(false); },
    });
  }

  protected addScanIdentifier(): void {
    const user = this.editingUser();
    const type = this.newScanType.value;
    const value = this.newScanValue.value?.trim();
    if (!user || !type || !value) return;

    this.scanIdLoading.set(true);
    this.adminService.addScanIdentifier(user.id, type, value).subscribe({
      next: () => {
        this.newScanValue.reset();
        this.loadScanIdentifiers(user.id);
        this.loadUsers();
        this.snackbar.success(this.translate.instant('admin.scanIdAdded'));
      },
      error: () => {
        this.scanIdLoading.set(false);
        this.snackbar.error(this.translate.instant('admin.scanIdAddFailed'));
      },
    });
  }

  protected removeScanIdentifier(id: number): void {
    const user = this.editingUser();
    if (!user) return;

    this.adminService.removeScanIdentifier(user.id, id).subscribe({
      next: () => {
        this.loadScanIdentifiers(user.id);
        this.loadUsers();
        this.snackbar.success(this.translate.instant('admin.scanIdRemoved'));
      },
      error: () => this.snackbar.error(this.translate.instant('admin.scanIdRemoveFailed')),
    });
  }

  protected scanTypeLabel(type: string): string {
    return this.scanTypeOptions.find(o => o.value === type)?.label ?? type;
  }

  // ── Track Types ──

  private loadTrackTypes(): void {
    this.loading.set(true);
    this.adminService.getTrackTypes().subscribe({
      next: (types) => { this.trackTypes.set(types); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('admin.loadTrackTypesFailed')); this.loading.set(false); },
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
          this.snackbar.success(this.translate.instant('admin.trackTypeUpdated'));
        },
        error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.trackTypeUpdateFailed')); },
      });
    } else {
      this.adminService.createTrackType(data).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeTrackTypeDialog();
          this.loadTrackTypes();
          this.snackbar.success(this.translate.instant('admin.trackTypeCreated'));
        },
        error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.trackTypeCreateFailed')); },
      });
    }
  }

  protected deleteTrackType(tt: TrackType): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('admin.deleteTrackTypeTitle'),
        message: this.translate.instant('admin.deleteTrackTypeMessage', { name: tt.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.deleteTrackType(tt.id).subscribe({
        next: () => {
          this.loadTrackTypes();
          this.snackbar.success(this.translate.instant('admin.trackTypeDeleted'));
        },
        error: () => this.snackbar.error(this.translate.instant('admin.trackTypeDeleteFailed')),
      });
    });
  }

  // ── Reference Data ──

  private loadReferenceData(): void {
    this.loading.set(true);
    this.adminService.getReferenceData().subscribe({
      next: (groups) => { this.referenceDataGroups.set(groups); this.loading.set(false); },
      error: () => { this.error.set(this.translate.instant('admin.loadRefDataFailed')); this.loading.set(false); },
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
      error: () => { this.error.set(this.translate.instant('admin.loadTerminologyFailed')); this.loading.set(false); },
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
        this.snackbar.success(this.translate.instant('admin.terminologySaved'));
      },
      error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.terminologySaveFailed')); },
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
    this.settingsLoaded.set(true);
    this.loading.set(true);
    this.adminService.getSystemSettings().subscribe({
      next: (settings) => {
        this.applySystemSettings(settings);
        this.loading.set(false);
      },
      error: () => { this.error.set(this.translate.instant('admin.loadSettingsFailed')); this.loading.set(false); },
    });
  }

  private loadNumberingSettings(): void {
    this.numberingLoaded.set(true);
    const labels = new Map(NUMBERING_SETTING_LABELS.map(l => [l.key, l.labelKey]));
    this.adminSettings.getGroup('Numbering').subscribe({
      next: (entries) => {
        const rows = [...entries]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(entry => {
            const control = new FormControl(entry.value?.toLowerCase() === 'true', { nonNullable: true });
            control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(enabled => this.saveNumberingSetting(entry.key, enabled, control));
            return { key: entry.key, labelKey: labels.get(entry.key) ?? null, displayName: entry.displayName, control };
          });
        this.numberingRows.set(rows);
        this.scrollToHighlightedSetting();
      },
      error: () => {
        this.numberingLoaded.set(false);
        this.snackbar.error(this.translate.instant('admin.loadSettingsFailed'));
      },
    });
  }

  private saveNumberingSetting(key: string, enabled: boolean, control: FormControl<boolean>): void {
    control.disable({ emitEvent: false });
    this.adminSettings.updateSetting(key, String(enabled)).subscribe({
      next: () => {
        control.enable({ emitEvent: false });
        this.snackbar.success(this.translate.instant('admin.settingsSaved'));
      },
      error: () => {
        control.setValue(!enabled, { emitEvent: false });
        control.enable({ emitEvent: false });
        this.snackbar.error(this.translate.instant('admin.settingsSaveFailed'));
      },
    });
  }

  private scrollToHighlightedSetting(): void {
    const key = this.highlightedSetting();
    if (!key) return;
    afterNextRender(() => {
      const target = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-setting-key]'))
        .find(el => el.dataset['settingKey'] === key);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, { injector: this.injector });
  }

  private static settingValidators(def: SystemSettingDefinition) {
    if (def.type === 'color') return [Validators.pattern(/^#[0-9a-fA-F]{6}$/)];
    if (def.type === 'number') return [Validators.pattern(/^\d+$/)];
    return [];
  }

  private applySystemSettings(settings: SystemSetting[]): void {
    this.systemSettings.set(settings);
    this.settingsEdits.set(new Map(settings.map(s => [s.key, s.value])));
    const values = new Map(settings.map(s => [s.key, s.value]));
    for (const def of this.settingDefinitions) {
      this.settingControls[def.key].setValue(values.get(def.key) ?? '', { emitEvent: false });
    }
    this.refreshInvalidSettings();
  }

  private refreshInvalidSettings(): void {
    this.invalidSettings.set(new Set(
      this.settingDefinitions.filter(def => this.settingControls[def.key].invalid).map(def => def.key),
    ));
  }

  protected onSettingChange(key: string, value: string): void {
    this.settingsEdits.update(map => {
      const updated = new Map(map);
      updated.set(key, value);
      return updated;
    });
    this.refreshInvalidSettings();
  }

  protected settingDefaultLabel(def: SystemSettingDefinition): string {
    const value = this.settingDefaults[def.key];
    if (value === undefined) return '';
    if (def.type === 'boolean') return this.translate.instant(value === 'true' ? 'common.enabled' : 'common.disabled');
    if (def.type === 'priority') return this.translate.instant(`priority.${value.toLowerCase()}`);
    return value;
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
    if (this.invalidSettings().size > 0) return;
    const edits = this.settingsEdits();
    const settings = this.settingDefinitions
      .filter(def => edits.has(def.key))
      .map(def => ({
        key: def.key,
        value: edits.get(def.key)!,
        description: this.translate.instant(def.descKey),
      }));

    this.saving.set(true);
    this.adminService.updateSystemSettings(settings).subscribe({
      next: (updated) => {
        this.applySystemSettings(updated);
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.settingsSaved'));

        const lookup = new Map(updated.map(s => [s.key, s.value]));
        this.themeService.setBrandColors(
          lookup.get('theme.primary_color') || undefined,
          lookup.get('theme.accent_color') || undefined,
        );
      },
      error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.settingsSaveFailed')); },
    });
  }

  // ── Company Profile ──

  private loadCompanyProfile(): void {
    this.profileLoaded.set(true);
    this.adminService.getCompanyProfile().subscribe({
      next: (profile) => {
        this.companyProfile.set(profile);
        this.profileForm.patchValue(profile, { emitEvent: false });
      },
      error: () => this.snackbar.error(this.translate.instant('admin.companyProfileLoadFailed')),
    });
  }

  // ── Remote health monitoring (opt-in) ──
  // Lives here on the settings tab rather than in the capability system: this is the
  // business owner deciding whether data about their system leaves the building, not
  // an integrator switching a feature on.

  private readonly telemetryService = inject(TelemetryService);

  protected readonly telemetryStatus = signal<TelemetryStatus | null>(null);
  protected readonly telemetryAgreement = signal<TelemetryAgreement | null>(null);
  protected readonly telemetryHistory = signal<TelemetryConsentRecord[]>([]);
  protected readonly telemetryConsentOpen = signal(false);
  protected readonly telemetrySaving = signal(false);

  /// What the enrollment state means in plain terms, so "Pending" doesn't read as
  /// something the customer has to fix.
  protected readonly telemetryStateKey = computed(() => {
    const status = this.telemetryStatus();
    if (!status || !status.enabled) return 'admin.telemetry.stateOff';
    if (status.agreementOutOfDate) return 'admin.telemetry.stateTermsChanged';
    switch (status.enrollmentStatus) {
      case 'Accepted': return 'admin.telemetry.stateActive';
      case 'Rejected': return 'admin.telemetry.stateRejected';
      case 'Pending': return 'admin.telemetry.statePending';
      default: return 'admin.telemetry.stateEnrolling';
    }
  });

  protected loadTelemetry(): void {
    this.telemetryService.getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => this.telemetryStatus.set(status),
        error: () => this.telemetryStatus.set(null),
      });
    this.telemetryService.getConsentHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (rows) => this.telemetryHistory.set(rows), error: () => this.telemetryHistory.set([]) });
  }

  /// Opening always fetches the current agreement: the operator must decide against
  /// the text this build actually ships, not a cached copy.
  protected openTelemetryConsent(): void {
    this.telemetryService.getAgreement()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (agreement) => {
          this.telemetryAgreement.set(agreement);
          this.telemetryConsentOpen.set(true);
        },
        error: () => this.snackbar.error(this.translate.instant('admin.telemetry.agreementLoadFailed')),
      });
  }

  protected recordTelemetryConsent(accepted: boolean): void {
    this.telemetrySaving.set(true);
    this.telemetryService.recordConsent(accepted, this.authService.user()?.email ?? null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.telemetryStatus.set(status);
          this.telemetrySaving.set(false);
          this.telemetryConsentOpen.set(false);
          this.snackbar.success(this.translate.instant(
            accepted ? 'admin.telemetry.accepted' : 'admin.telemetry.declined'));
          this.loadTelemetry();
        },
        error: () => {
          this.telemetrySaving.set(false);
          this.snackbar.error(this.translate.instant('admin.telemetry.saveFailed'));
        },
      });
  }

  /// Switching off is a decline — recorded exactly like one, so the history shows
  /// consent being withdrawn rather than the row simply disappearing.
  protected disableTelemetry(): void {
    this.recordTelemetryConsent(false);
  }

  protected saveCompanyProfile(): void {
    this.profileSaving.set(true);
    const v = this.profileForm.getRawValue();
    this.adminService.updateCompanyProfile({
      name: v.name ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      ein: v.ein ?? '',
      website: v.website ?? '',
    }).subscribe({
      next: (profile) => {
        this.companyProfile.set(profile);
        this.profileSaving.set(false);
        this.snackbar.success(this.translate.instant('admin.companyProfileSaved'));
      },
      error: () => { this.profileSaving.set(false); this.snackbar.error(this.translate.instant('admin.companyProfileSaveFailed')); },
    });
  }

  // ── Company Locations ──

  private loadCompanyLocations(): void {
    this.locationsLoaded.set(true);
    this.adminService.getCompanyLocations().subscribe({
      next: (locations) => this.companyLocations.set(locations),
      error: () => this.snackbar.error(this.translate.instant('admin.locationsLoadFailed')),
    });
  }

  protected openCreateLocation(): void {
    this.editingLocation.set(null);
    this.showLocationDialog.set(true);
  }

  protected openEditLocation(location: CompanyLocation): void {
    this.editingLocation.set(location);
    this.showLocationDialog.set(true);
  }

  protected closeLocationDialog(): void {
    this.showLocationDialog.set(false);
  }

  protected saveLocation(data: Partial<CompanyLocation>): void {
    this.saving.set(true);
    const editing = this.editingLocation();

    if (editing) {
      this.adminService.updateCompanyLocation(editing.id, data).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeLocationDialog();
          this.loadCompanyLocations();
          this.snackbar.success(this.translate.instant('admin.locationUpdated'));
        },
        error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.locationUpdateFailed')); },
      });
    } else {
      this.adminService.createCompanyLocation(data).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeLocationDialog();
          this.loadCompanyLocations();
          this.snackbar.success(this.translate.instant('admin.locationCreated'));
        },
        error: () => { this.saving.set(false); this.snackbar.error(this.translate.instant('admin.locationCreateFailed')); },
      });
    }
  }

  protected deleteLocation(location: CompanyLocation): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('admin.deleteLocationTitle'),
        message: this.translate.instant('admin.deleteLocationMessage', { name: location.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.deleteCompanyLocation(location.id).subscribe({
        next: () => { this.loadCompanyLocations(); this.snackbar.success(this.translate.instant('admin.locationDeleted')); },
        error: () => this.snackbar.error(this.translate.instant('admin.locationDeleteFailed')),
      });
    });
  }

  protected setDefaultLocation(location: CompanyLocation): void {
    this.adminService.setDefaultCompanyLocation(location.id).subscribe({
      next: () => { this.loadCompanyLocations(); this.snackbar.success(this.translate.instant('admin.locationSetDefault', { name: location.name })); },
      error: () => this.snackbar.error(this.translate.instant('admin.locationSetDefaultFailed')),
    });
  }

  // ── Pay Period Locking ──

  protected confirmLockPayPeriod(): void {
    const date = this.lockThroughControl.value;
    if (!date) return;

    const formatted = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Lock Pay Period?',
        message: `This will lock all unlocked time entries through ${formatted}. Locked entries cannot be edited or deleted. This action cannot be undone.`,
        confirmLabel: 'Lock Period',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.lockingPeriod.set(true);
      this.adminService.lockPayPeriod(date).subscribe({
        next: (result) => {
          this.lockingPeriod.set(false);
          this.lockThroughControl.reset();
          this.snackbar.success(`${result.lockedCount} time ${result.lockedCount === 1 ? 'entry' : 'entries'} locked successfully.`);
        },
        error: () => {
          this.lockingPeriod.set(false);
          this.snackbar.error(this.translate.instant('admin.lockPeriodFailed'));
        },
      });
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
        this.snackbar.success(this.translate.instant('admin.logoUploaded'));
        this.themeService.loadBrandSettings();
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('admin.logoUploadFailed'));
      },
    });
  }

  protected removeLogo(): void {
    this.saving.set(true);
    this.adminService.deleteLogo().subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.logoRemoved'));
        this.themeService.loadBrandSettings();
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('admin.logoRemoveFailed'));
      },
    });
  }

  // ── Brand Lockups ──

  protected onLockupFileSelected(event: Event, kind: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.saving.set(true);
    this.adminService.uploadLockup(kind, file).subscribe({
      next: () => {
        this.saving.set(false);
        this.branding.refresh();
        this.snackbar.success(this.translate.instant('admin.lockupUploaded'));
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('admin.lockupUploadFailed'));
      },
    });
  }

  protected resetLockup(kind: string): void {
    this.saving.set(true);
    this.adminService.deleteLockup(kind).subscribe({
      next: () => {
        this.saving.set(false);
        this.branding.refresh();
        this.snackbar.success(this.translate.instant('admin.lockupReset'));
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('admin.lockupResetFailed'));
      },
    });
  }
}
