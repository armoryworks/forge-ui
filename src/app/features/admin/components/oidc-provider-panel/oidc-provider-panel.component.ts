import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { debounceTime, map } from 'rxjs';

import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DateRangePickerComponent, DateRange } from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OidcAdminService } from '../../services/oidc-admin.service';
import { OidcAuditEventListItem } from '../../models/oidc-audit-event-list-item.model';
import { OidcAuditEventType } from '../../models/oidc-audit-event-type.model';
import { OidcAuditFilter } from '../../models/oidc-audit-filter.model';
import { OidcClientListItem } from '../../models/oidc-client-list-item.model';
import { OidcScopeListItem } from '../../models/oidc-scope-list-item.model';
import { OidcTicketListItem } from '../../models/oidc-ticket-list-item.model';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { OidcProviderSettings } from '../../models/oidc-provider-settings.model';
import { OidcMintTicketDialogComponent } from '../oidc-mint-ticket-dialog/oidc-mint-ticket-dialog.component';
import { OidcClientDetailDialogComponent } from '../oidc-client-detail-dialog/oidc-client-detail-dialog.component';
import { OidcProvisionClientDialogComponent } from '../oidc-provision-client-dialog/oidc-provision-client-dialog.component';
import { OidcScopeEditorDialogComponent } from '../oidc-scope-editor-dialog/oidc-scope-editor-dialog.component';
import { OidcAuditDetailDialogComponent } from '../oidc-audit-detail-dialog/oidc-audit-detail-dialog.component';

type OidcSectionKey = 'clients' | 'tickets' | 'scopes' | 'audit' | 'docs';
const SECTIONS: OidcSectionKey[] = ['clients', 'tickets', 'scopes', 'audit', 'docs'];

const AUDIT_EVENT_OPTIONS: SelectOption[] = [
  { value: null, label: '-- All events --' },
  { value: 'TicketIssued', label: 'Ticket issued' },
  { value: 'TicketRedeemed', label: 'Ticket redeemed' },
  { value: 'TicketExpired', label: 'Ticket expired' },
  { value: 'TicketRevoked', label: 'Ticket revoked' },
  { value: 'ClientRegistered', label: 'Client registered' },
  { value: 'ClientApproved', label: 'Client approved' },
  { value: 'ClientSuspended', label: 'Client suspended' },
  { value: 'ClientRevoked', label: 'Client revoked' },
  { value: 'ClientUpdated', label: 'Client updated' },
  { value: 'SecretRotated', label: 'Secret rotated' },
  { value: 'RegistrationAccessTokenRotated', label: 'Registration token rotated' },
  { value: 'ConsentGranted', label: 'Consent granted' },
  { value: 'ConsentRevoked', label: 'Consent revoked' },
  { value: 'ConsentDenied', label: 'Consent denied' },
  { value: 'TokenIssued', label: 'Token issued' },
  { value: 'AuthorizationCodeIssued', label: 'Authorization code issued' },
  { value: 'UserAuthenticated', label: 'User authenticated' },
  { value: 'RoleGateDenied', label: 'Role gate denied' },
  { value: 'ScopeDenied', label: 'Scope denied' },
  { value: 'RedirectUriMismatch', label: 'Redirect URI mismatch' },
  { value: 'InvalidSoftwareStatement', label: 'Invalid software statement' },
  { value: 'ScopeCreated', label: 'Scope created' },
  { value: 'ScopeUpdated', label: 'Scope updated' },
  { value: 'ScopeDeleted', label: 'Scope deleted' },
];

@Component({
  selector: 'app-oidc-provider-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTabsModule, DataTableComponent, ColumnCellDirective,
    InputComponent, SelectComponent, ToggleComponent, DateRangePickerComponent, ToolbarComponent, SpacerDirective,
    OidcMintTicketDialogComponent, OidcClientDetailDialogComponent, OidcProvisionClientDialogComponent,
    OidcScopeEditorDialogComponent, OidcAuditDetailDialogComponent,
  ],
  templateUrl: './oidc-provider-panel.component.html',
  styleUrl: './oidc-provider-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcProviderPanelComponent implements OnInit {
  private readonly oidc = inject(OidcAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clients = signal<OidcClientListItem[]>([]);
  protected readonly tickets = signal<OidcTicketListItem[]>([]);
  protected readonly scopes = signal<OidcScopeListItem[]>([]);
  protected readonly audit = signal<OidcAuditEventListItem[]>([]);

  protected readonly loadingClients = signal(false);
  protected readonly loadingTickets = signal(false);
  protected readonly loadingScopes = signal(false);
  protected readonly loadingAudit = signal(false);

  protected readonly showMintDialog = signal(false);
  protected readonly showProvisionDialog = signal(false);
  protected readonly selectedClientId = signal<string | null>(null);
  protected readonly scopeEditorOpen = signal(false);
  protected readonly scopeBeingEdited = signal<OidcScopeListItem | null>(null);
  protected readonly selectedAuditEvent = signal<OidcAuditEventListItem | null>(null);

  // Provider settings (enable toggle + public base URL) — surfaced in the header.
  protected readonly settings = signal<OidcProviderSettings>({ providerEnabled: false, publicBaseUrl: '' });
  protected readonly settingsLoaded = signal(false);
  protected readonly settingsSaving = signal(false);
  protected readonly settingsForm = new FormGroup({
    providerEnabled: new FormControl<boolean>(false, { nonNullable: true }),
    publicBaseUrl: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.pattern(/^(https?:\/\/).+/)],
    }),
  });

  protected readonly auditEventOptions = AUDIT_EVENT_OPTIONS;

  protected readonly auditEventTypeControl = new FormControl<OidcAuditEventType | null>(null);
  protected readonly auditClientIdControl = new FormControl<string>('', { nonNullable: true });
  protected readonly auditActorUserIdControl = new FormControl<string>('', { nonNullable: true });
  protected readonly auditDateRangeControl = new FormControl<DateRange>({ start: null, end: null }, { nonNullable: true });

  private readonly auditEventTypeSignal = toSignal(this.auditEventTypeControl.valueChanges, { initialValue: null });
  private readonly auditClientIdSignal = toSignal(this.auditClientIdControl.valueChanges.pipe(debounceTime(250)), { initialValue: '' });
  private readonly auditActorUserIdSignal = toSignal(this.auditActorUserIdControl.valueChanges.pipe(debounceTime(250)), { initialValue: '' });
  private readonly auditDateRangeSignal = toSignal(this.auditDateRangeControl.valueChanges, { initialValue: { start: null, end: null } as DateRange });

  protected readonly hasAuditFilters = computed(() => {
    const eventType = this.auditEventTypeSignal();
    const clientId = this.auditClientIdSignal();
    const actor = this.auditActorUserIdSignal();
    const range = this.auditDateRangeSignal();
    return !!(eventType || (clientId && clientId.length > 0) || (actor && actor.length > 0) || range?.start || range?.end);
  });

  protected readonly activeSection = toSignal(
    this.route.queryParamMap.pipe(
      map(p => {
        const s = p.get('oidcSection') as OidcSectionKey | null;
        return s && SECTIONS.includes(s) ? s : 'clients';
      }),
    ),
    { initialValue: 'clients' as OidcSectionKey },
  );

  protected readonly clientColumns: ColumnDef[] = [
    { field: 'clientId', header: 'Client ID', sortable: true, width: '220px' },
    { field: 'displayName', header: 'Name', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: [
        { value: 'Pending', label: 'Pending' },
        { value: 'Active', label: 'Active' },
        { value: 'Suspended', label: 'Suspended' },
        { value: 'Revoked', label: 'Revoked' },
      ] },
    { field: 'ownerEmail', header: 'Owner', sortable: true },
    { field: 'isFirstParty', header: 'First-party', sortable: true, width: '110px', align: 'center' },
    { field: 'requireConsent', header: 'Consent', sortable: true, width: '100px', align: 'center' },
    { field: 'lastUsedAt', header: 'Last used', sortable: true, type: 'date', width: '140px' },
  ];

  protected readonly ticketColumns: ColumnDef[] = [
    { field: 'ticketPrefix', header: 'Prefix', sortable: true, width: '120px' },
    { field: 'expectedClientName', header: 'Expected client', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: [
        { value: 'Issued', label: 'Issued' },
        { value: 'Redeemed', label: 'Redeemed' },
        { value: 'Expired', label: 'Expired' },
        { value: 'Revoked', label: 'Revoked' },
      ] },
    { field: 'allowedRedirectUriPrefix', header: 'Redirect prefix', sortable: true },
    { field: 'allowedScopesCsv', header: 'Scopes', sortable: false },
    { field: 'issuedAt', header: 'Issued', sortable: true, type: 'date', width: '140px' },
    { field: 'expiresAt', header: 'Expires', sortable: true, type: 'date', width: '140px' },
  ];

  protected readonly scopeColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true, width: '180px' },
    { field: 'displayName', header: 'Display name', sortable: true },
    { field: 'description', header: 'Description', sortable: false },
    { field: 'isSystem', header: 'System', sortable: true, width: '90px', align: 'center' },
    { field: 'isActive', header: 'Active', sortable: true, width: '90px', align: 'center' },
  ];

  protected readonly auditColumns: ColumnDef[] = [
    { field: 'createdAt', header: 'When', sortable: true, type: 'date', width: '150px' },
    { field: 'eventType', header: 'Event', sortable: true, filterable: true, type: 'enum' },
    { field: 'clientId', header: 'Client', sortable: true },
    { field: 'actorUserId', header: 'Actor', sortable: true, type: 'number', width: '80px' },
    { field: 'actorIpAddress', header: 'IP', sortable: true, width: '140px' },
    { field: 'scopeName', header: 'Scope', sortable: true },
  ];

  ngOnInit(): void {
    this.loadForSection(this.activeSection());
    this.loadSettings();
  }

  private loadSettings(): void {
    this.oidc.getSettings().subscribe({
      next: (s) => {
        this.settings.set(s);
        this.settingsForm.patchValue(s, { emitEvent: false });
        this.settingsForm.markAsPristine();
        this.settingsLoaded.set(true);
      },
      error: () => this.settingsLoaded.set(true),
    });
  }

  protected saveSettings(): void {
    if (this.settingsForm.invalid || this.settingsSaving()) return;
    const v = this.settingsForm.getRawValue();
    const body: OidcProviderSettings = {
      providerEnabled: v.providerEnabled,
      publicBaseUrl: (v.publicBaseUrl || '').trim().replace(/\/$/, ''),
    };
    this.settingsSaving.set(true);
    this.oidc.updateSettings(body).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.settingsForm.patchValue(s, { emitEvent: false });
        this.settingsForm.markAsPristine();
        this.settingsSaving.set(false);
        this.snackbar.success('OIDC provider settings saved.');
      },
      error: () => this.settingsSaving.set(false),
    });
  }

  protected openProvisionClient(): void {
    this.showProvisionDialog.set(true);
  }

  protected onProvisionDialogClosed(): void {
    this.showProvisionDialog.set(false);
  }

  protected onClientProvisioned(): void {
    if (this.activeSection() !== 'clients') {
      this.selectSection('clients');
    } else {
      this.loadClients();
    }
  }

  protected selectSection(section: OidcSectionKey): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { oidcSection: section },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadForSection(section);
  }

  protected sectionIndex(): number {
    return SECTIONS.indexOf(this.activeSection());
  }

  protected onTabChange(index: number): void {
    const section = SECTIONS[index];
    if (section) this.selectSection(section);
  }

  private loadForSection(section: OidcSectionKey): void {
    switch (section) {
      case 'clients': this.loadClients(); break;
      case 'tickets': this.loadTickets(); break;
      case 'scopes': this.loadScopes(); break;
      case 'audit': this.loadAudit(); break;
      case 'docs': break;
    }
  }

  private loadClients(): void {
    this.loadingClients.set(true);
    this.oidc.listClients().subscribe({
      next: (list) => { this.clients.set(list); this.loadingClients.set(false); },
      error: () => { this.loadingClients.set(false); },
    });
  }

  private loadTickets(): void {
    this.loadingTickets.set(true);
    this.oidc.listTickets().subscribe({
      next: (list) => { this.tickets.set(list); this.loadingTickets.set(false); },
      error: () => { this.loadingTickets.set(false); },
    });
  }

  private loadScopes(): void {
    this.loadingScopes.set(true);
    this.oidc.listScopes(true).subscribe({
      next: (list) => { this.scopes.set(list); this.loadingScopes.set(false); },
      error: () => { this.loadingScopes.set(false); },
    });
  }

  private loadAudit(): void {
    this.loadingAudit.set(true);
    const filter = this.buildAuditFilter();
    this.oidc.listAudit(filter).subscribe({
      next: (list) => { this.audit.set(list); this.loadingAudit.set(false); },
      error: () => { this.loadingAudit.set(false); },
    });
  }

  private buildAuditFilter(): OidcAuditFilter {
    const filter: OidcAuditFilter = { take: 200 };
    const eventType = this.auditEventTypeSignal();
    const clientId = this.auditClientIdSignal();
    const actor = this.auditActorUserIdSignal();
    const range = this.auditDateRangeSignal();
    if (eventType) filter.eventType = eventType;
    if (clientId && clientId.trim().length > 0) filter.clientId = clientId.trim();
    if (actor && actor.trim().length > 0) {
      const parsed = parseInt(actor.trim(), 10);
      if (!isNaN(parsed)) filter.actorUserId = parsed;
    }
    if (range?.start) filter.since = this.toIsoUtc(range.start);
    if (range?.end) {
      const endOfDay = new Date(range.end);
      endOfDay.setHours(23, 59, 59, 999);
      filter.until = endOfDay.toISOString();
    }
    return filter;
  }

  private toIsoUtc(d: Date): string {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  protected applyAuditFilters(): void {
    this.loadAudit();
  }

  protected clearAuditFilters(): void {
    this.auditEventTypeControl.setValue(null);
    this.auditClientIdControl.setValue('');
    this.auditActorUserIdControl.setValue('');
    this.auditDateRangeControl.setValue({ start: null, end: null });
    this.loadAudit();
  }

  protected openAuditDetail(row: unknown): void {
    this.selectedAuditEvent.set(row as OidcAuditEventListItem);
  }

  protected onAuditDetailClosed(): void {
    this.selectedAuditEvent.set(null);
  }

  protected refreshActive(): void {
    this.loadForSection(this.activeSection());
  }

  protected openMintTicket(): void {
    this.showMintDialog.set(true);
  }

  protected onMintDialogClosed(): void {
    this.showMintDialog.set(false);
  }

  protected onTicketMinted(): void {
    if (this.activeSection() !== 'tickets') {
      this.selectSection('tickets');
    } else {
      this.loadTickets();
    }
  }

  protected openClientDetail(row: unknown): void {
    const c = row as OidcClientListItem;
    if (c?.clientId) this.selectedClientId.set(c.clientId);
  }

  protected onClientDetailClosed(): void {
    this.selectedClientId.set(null);
  }

  protected onClientChanged(): void {
    this.loadClients();
  }

  protected openCreateScope(): void {
    this.scopeBeingEdited.set(null);
    this.scopeEditorOpen.set(true);
  }

  protected openEditScope(row: unknown): void {
    this.scopeBeingEdited.set(row as OidcScopeListItem);
    this.scopeEditorOpen.set(true);
  }

  protected onScopeEditorClosed(): void {
    this.scopeEditorOpen.set(false);
    this.scopeBeingEdited.set(null);
  }

  protected onScopeSaved(): void {
    this.loadScopes();
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Active': return 'chip chip--success';
      case 'Pending': return 'chip chip--warning';
      case 'Suspended': return 'chip chip--info';
      case 'Revoked': return 'chip chip--error';
      case 'Issued': return 'chip chip--info';
      case 'Redeemed': return 'chip chip--success';
      case 'Expired': return 'chip chip--muted';
      default: return 'chip';
    }
  }
}
