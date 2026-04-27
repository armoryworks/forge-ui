import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { AuditLogEntry } from '../../models/audit-log-entry.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-audit-log-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DataTableComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    LoadingBlockDirective,
    MatPaginatorModule,
  ],
  templateUrl: './audit-log-panel.component.html',
  styleUrl: './audit-log-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPanelComponent {
  private readonly adminService = inject(AdminService);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly entries = signal<AuditLogEntry[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly entityTypeControl = new FormControl<string>('');
  protected readonly actionControl = new FormControl<string>('');
  protected readonly actionPresetControl = new FormControl<string>('');
  protected readonly fromDateControl = new FormControl<Date | null>(null);
  protected readonly toDateControl = new FormControl<Date | null>(null);

  protected readonly entityTypeOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('adminPanels.auditLog.allTypes') },
    { value: 'Job', label: this.translate.instant('adminPanels.auditLog.types.job') },
    { value: 'Part', label: this.translate.instant('adminPanels.auditLog.types.part') },
    { value: 'Customer', label: this.translate.instant('adminPanels.auditLog.types.customer') },
    { value: 'Vendor', label: this.translate.instant('adminPanels.auditLog.types.vendor') },
    { value: 'Expense', label: this.translate.instant('adminPanels.auditLog.types.expense') },
    { value: 'Invoice', label: this.translate.instant('adminPanels.auditLog.types.invoice') },
    { value: 'Payment', label: this.translate.instant('adminPanels.auditLog.types.payment') },
    { value: 'User', label: this.translate.instant('adminPanels.auditLog.types.user') },
    { value: 'PurchaseOrder', label: this.translate.instant('adminPanels.auditLog.types.purchaseOrder') },
    { value: 'SalesOrder', label: this.translate.instant('adminPanels.auditLog.types.salesOrder') },
    { value: 'Quote', label: this.translate.instant('adminPanels.auditLog.types.quote') },
    { value: 'Shipment', label: this.translate.instant('adminPanels.auditLog.types.shipment') },
    { value: 'TimeEntry', label: this.translate.instant('adminPanels.auditLog.types.timeEntry') },
    { value: 'Asset', label: this.translate.instant('adminPanels.auditLog.types.asset') },
    // Phase 3 / WU-03 retrofit — the system-wide audit log now also captures
    // identity, MFA, role, and BI-key events. Surface those entity types so
    // the per-entity filter can scope to them.
    { value: 'ApplicationUser', label: this.translate.instant('adminPanels.auditLog.types.identity') },
    { value: 'BiApiKey', label: this.translate.instant('adminPanels.auditLog.types.biApiKey') },
  ];

  /**
   * Phase 3 / WU-03 retrofit — quick-pick presets for the system-wide events
   * that became visible in the audit log after WU-03 (login / MFA / role /
   * BI key). Selecting a preset writes through to `actionControl`, which
   * triggers the existing reload effect; "" clears the action filter.
   */
  protected readonly actionPresetOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('adminPanels.auditLog.presets.allActions') },
    { value: 'UserLoggedIn', label: this.translate.instant('adminPanels.auditLog.presets.userLoggedIn') },
    { value: 'UserLoginFailed', label: this.translate.instant('adminPanels.auditLog.presets.userLoginFailed') },
    { value: 'UserLoggedOut', label: this.translate.instant('adminPanels.auditLog.presets.userLoggedOut') },
    { value: 'UserPasswordChanged', label: this.translate.instant('adminPanels.auditLog.presets.userPasswordChanged') },
    { value: 'MfaEnabled', label: this.translate.instant('adminPanels.auditLog.presets.mfaEnabled') },
    { value: 'MfaDisabled', label: this.translate.instant('adminPanels.auditLog.presets.mfaDisabled') },
    { value: 'RoleAssigned', label: this.translate.instant('adminPanels.auditLog.presets.roleAssigned') },
    { value: 'UserActivated', label: this.translate.instant('adminPanels.auditLog.presets.userActivated') },
    { value: 'UserDeactivated', label: this.translate.instant('adminPanels.auditLog.presets.userDeactivated') },
    { value: 'BiApiKeyIssued', label: this.translate.instant('adminPanels.auditLog.presets.biApiKeyIssued') },
    { value: 'BiApiKeyRevoked', label: this.translate.instant('adminPanels.auditLog.presets.biApiKeyRevoked') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'createdAt', header: this.translate.instant('adminPanels.auditLog.cols.time'), sortable: true, type: 'date', width: '140px' },
    { field: 'userName', header: this.translate.instant('adminPanels.auditLog.cols.user'), sortable: true, width: '160px' },
    { field: 'action', header: this.translate.instant('adminPanels.auditLog.cols.action'), sortable: true, width: '120px' },
    { field: 'entityType', header: this.translate.instant('adminPanels.auditLog.cols.type'), sortable: true, width: '120px' },
    { field: 'entityId', header: this.translate.instant('adminPanels.auditLog.cols.id'), width: '60px', align: 'right' },
    { field: 'details', header: this.translate.instant('adminPanels.auditLog.cols.details') },
    { field: 'ipAddress', header: this.translate.instant('adminPanels.auditLog.cols.ip'), width: '130px' },
  ];

  constructor() {
    effect(() => {
      this.load();
    });

    this.entityTypeControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
    this.actionControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
    this.fromDateControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });
    this.toDateControl.valueChanges.subscribe(() => { this.page.set(1); this.load(); });

    // Phase 3 / WU-03 retrofit — preset writes through to the freeform action
    // filter. emitEvent: false on the secondary control so we only trigger
    // one reload via actionControl's own valueChanges subscription.
    this.actionPresetControl.valueChanges.subscribe(value => {
      if (this.actionControl.value !== (value ?? '')) {
        this.actionControl.setValue(value ?? '');
      }
    });
  }

  protected load(): void {
    this.isLoading.set(true);

    const entityType = this.entityTypeControl.value || undefined;
    const action = this.actionControl.value || undefined;
    const fromDate = this.fromDateControl.value;
    const toDate = this.toDateControl.value;

    this.adminService.getAuditLog({
      page: this.page(),
      pageSize: this.pageSize(),
      entityType,
      action,
      from: fromDate ? (toIsoDate(fromDate) ?? undefined) : undefined,
      to: toDate ? (toIsoDate(toDate) ?? undefined) : undefined,
    }).subscribe({
      next: (result) => {
        this.entries.set(result.data);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.load();
  }
}
