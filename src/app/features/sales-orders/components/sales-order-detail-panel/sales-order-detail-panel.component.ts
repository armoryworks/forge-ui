import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderDetail } from '../../models/sales-order-detail.model';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { SalesOrderInvoice } from '../../models/sales-order-invoice.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { FileUploadZoneComponent, UploadedFile } from '../../../../shared/components/file-upload-zone/file-upload-zone.component';
import { CREDIT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FileAttachment } from '../../../../shared/models/file.model';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { ScheduleTimelineComponent } from '../schedule-timeline/schedule-timeline.component';
import { ScheduleMilestone } from '../../models/schedule-milestone.model';
import { ShipmentDialogComponent } from '../../../shipments/components/shipment-dialog/shipment-dialog.component';
import { SalesOrderStages } from '../../models/sales-order-stage.model';
import { CustomerPoDocument } from '../../models/customer-po-document.model';
import { AccountingService } from '../../../../shared/services/accounting.service';
import { InvoiceDialogComponent } from '../../../invoices/components/invoice-dialog/invoice-dialog.component';
import { CapDirective } from '../../../../shared/directives/cap.directive';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SalesOrderAcceptanceService, RecordAcceptanceMethod } from '../../services/sales-order-acceptance.service';
import { SalesOrderAcceptance } from '../../models/sales-order-acceptance.model';

/** Capability gating the whole customer-acceptance feature. */
const CAP_SO_ACCEPTANCE = 'CAP-O2C-SO-ACCEPTANCE';

type TabId = 'overview' | 'lines' | 'schedule' | 'stages' | 'shipments' | 'returns' | 'documents' | 'invoices' | 'customer-po' | 'acceptance' | 'activity';

@Component({
  selector: 'app-sales-order-detail-panel',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe, ReactiveFormsModule,
    MatTooltipModule, LoadingBlockDirective,
    BarcodeInfoComponent, EntityActivitySectionComponent,
    EntityLinkComponent, CurrencyDisplayComponent, FileUploadZoneComponent, EmptyStateComponent,
    EntityPickerComponent, InputComponent, SelectComponent, DatepickerComponent, CurrencyInputComponent,
    ScheduleTimelineComponent, InvoiceDialogComponent, ShipmentDialogComponent,
    CapDirective, DialogComponent, TextareaComponent,
  ],
  templateUrl: './sales-order-detail-panel.component.html',
  styleUrl: './sales-order-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderDetailPanelComponent {
  private readonly soService = inject(SalesOrderService);
  private readonly acceptanceService = inject(SalesOrderAcceptanceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly accountingService = inject(AccountingService);
  private readonly capabilityService = inject(CapabilityService);
  private readonly auth = inject(AuthService);

  // ---- ACCOUNTING BOUNDARY ---- invoice creation is standalone-mode-only;
  // integrated installs manage invoices in the connected accounting system.
  protected readonly isStandalone = this.accountingService.isStandalone;
  protected readonly showCreateInvoiceDialog = signal(false);
  // Ship hook — opens the shipment dialog pre-scoped to this order (flows into rate/label/mark-shipped).
  protected readonly showShipDialog = signal(false);

  readonly salesOrderId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<SalesOrderDetail>();
  readonly changed = output<void>();

  protected readonly so = signal<SalesOrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly activeTab = signal<TabId>('overview');

  // --- Line editing (Draft only). editingLineId: null = closed, 0 = adding, >0 = editing. ---
  protected readonly editingLineId = signal<number | null>(null);
  protected readonly savingLine = signal(false);
  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
    unitPrice: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });
  protected readonly expandedLines = signal<Set<number>>(new Set());
  protected readonly scheduleMilestones = signal<ScheduleMilestone[]>([]);
  protected readonly scheduleLoading = signal(false);
  protected readonly documents = signal<FileAttachment[]>([]);
  protected readonly invoices = signal<SalesOrderInvoice[]>([]);
  // S4a customer-PO doc + S4c staged schedule
  protected readonly customerPo = signal<CustomerPoDocument | null>(null);
  protected readonly customerPoLoading = signal(false);
  protected readonly stages = signal<SalesOrderStages | null>(null);
  protected readonly stagesLoading = signal(false);

  // --- Customer acceptance (CAP-O2C-SO-ACCEPTANCE) ---
  protected readonly acceptances = signal<SalesOrderAcceptance[]>([]);
  protected readonly acceptanceLoading = signal(false);
  protected readonly savingAcceptance = signal(false);
  protected readonly showRecordDialog = signal(false);
  protected readonly showSignatureDialog = signal(false);
  protected readonly showPortalDialog = signal(false);
  protected readonly showEmailIngestDialog = signal(false);
  protected readonly signatureSubmitUrl = signal<string | null>(null);
  protected readonly portalLink = signal<string | null>(null);
  protected readonly recordFile = signal<File | null>(null);

  /** Reactive to the capability descriptor snapshot (admin toggles, SignalR push). */
  protected readonly acceptanceCapEnabled = computed(() => this.capabilityService.isEnabled(CAP_SO_ACCEPTANCE));
  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));
  protected readonly acceptedAcceptance = computed(() => this.acceptances().find(a => a.status === 'Accepted') ?? null);
  protected readonly hasAcceptedAcceptance = computed(() => this.acceptedAcceptance() !== null);
  /**
   * Pre-empt the server's 409: when the feature is on and no Accepted record
   * exists, the Confirm/release action is blocked with a visible reason.
   */
  protected readonly confirmBlockedByAcceptance = computed(
    () => this.acceptanceCapEnabled() && !this.hasAcceptedAcceptance(),
  );

  protected readonly recordForm = new FormGroup({
    method: new FormControl<RecordAcceptanceMethod>('ManualUpload', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl('', { nonNullable: true }),
  });
  private readonly recordMethod = toSignal(this.recordForm.controls.method.valueChanges, { initialValue: 'ManualUpload' as RecordAcceptanceMethod });
  protected readonly recordNeedsFile = computed(() => this.recordMethod() !== 'Verbal');
  protected readonly recordValid = computed(() => !this.recordNeedsFile() || this.recordFile() !== null);

  protected readonly signatureForm = new FormGroup({
    signerName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    signerEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  protected readonly portalForm = new FormGroup({
    recipientEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    verificationKey: new FormControl('', { nonNullable: true }),
    validDays: new FormControl<number | null>(null),
  });

  protected readonly emailIngestForm = new FormGroup({
    fromEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    note: new FormControl('', { nonNullable: true }),
  });

  protected readonly acceptanceMethodOptions = computed<SelectOption[]>(() => [
    { value: 'ManualUpload', label: this.translate.instant('salesOrders.acceptance.methodManualUpload') },
    { value: 'Fax', label: this.translate.instant('salesOrders.acceptance.methodFax') },
    { value: 'Email', label: this.translate.instant('salesOrders.acceptance.methodEmail') },
    { value: 'Verbal', label: this.translate.instant('salesOrders.acceptance.methodVerbal') },
  ]);

  protected readonly hasData = computed(() => this.so() !== null);

  protected readonly documentCount = computed(() => this.documents().length);
  protected readonly invoiceCount = computed(() => this.invoices().length);

  protected readonly totalInvoiced = computed(() =>
    this.invoices().reduce((sum, inv) => sum + inv.totalAmount, 0),
  );

  protected readonly hasUninvoicedShipments = computed(() => {
    const so = this.so();
    const invs = this.invoices();
    if (!so || !so.shipments?.length) return false;
    const invoicedShipmentIds = new Set(
      invs.filter(i => i.shipmentNumbers.length > 0).flatMap(i => i.shipmentNumbers),
    );
    return so.shipments.some(s => !invoicedShipmentIds.has(s.shipmentNumber));
  });

  protected readonly scheduleAtRiskCount = computed(() =>
    this.scheduleMilestones().filter(m => m.isAtRisk).length
  );

  protected readonly shipmentCount = computed(() => this.so()?.shipments?.length ?? 0);

  protected readonly hasShipmentWarning = computed(() => {
    const so = this.so();
    if (!so) return false;
    const status = so.status;
    if (status === 'Draft' || status === 'Cancelled') return false;
    return so.lines.some(l => l.remainingQuantity > 0);
  });

  protected readonly openReturnCount = computed(() => {
    const so = this.so();
    if (!so) return 0;
    return so.returns?.filter(r => r.status !== 'Closed').length ?? 0;
  });

  protected readonly fulfillmentSummary = computed(() => {
    const so = this.so();
    if (!so) return null;
    const totalLines = so.lines.length;
    const linesWithJobs = so.lines.filter(l => l.jobs.length > 0).length;
    const linesShipped = so.lines.filter(l => l.isFullyShipped).length;
    const shipmentCount = so.shipments?.length ?? 0;
    return { totalLines, linesWithJobs, linesShipped, shipmentCount };
  });

  protected readonly linesWithNoJobs = computed(() => {
    const so = this.so();
    if (!so) return [];
    const status = so.status;
    if (status === 'Draft' || status === 'Cancelled') return [];
    return so.lines.filter(l => l.jobs.length === 0);
  });

  // --- Header editing (#8 / SO-8 / AUDIT-S3b — Draft only) ---
  // SO-only header fields (CustomerPO / CreditTerms / RequestedDelivery) had no edit
  // path after a quote→order convert; the overview rendered them read-only and only
  // when already set, so post-convert (all null) there was no way to populate them.
  protected readonly editingHeader = signal(false);
  protected readonly savingHeader = signal(false);
  protected readonly creditTermsOptions = CREDIT_TERMS_OPTIONS;
  protected readonly headerForm = new FormGroup({
    customerPO: new FormControl<string>('', { nonNullable: true }),
    creditTerms: new FormControl<string | null>(null),
    requestedDeliveryDate: new FormControl<Date | null>(null),
    billingAddressId: new FormControl<number | null>(null),
  });
  protected readonly canEditHeader = computed(() => this.so()?.status === 'Draft');

  // Billing-address picker options for the Draft header edit (#8 / SO-8). Loaded
  // lazily when the user enters edit mode (the customer's saved addresses).
  protected readonly customerAddresses = signal<CustomerAddress[]>([]);
  protected readonly billingAddressOptions = computed<SelectOption[]>(() => {
    const opts: SelectOption[] = this.customerAddresses()
      .filter(a => a.addressType === 'Billing' || a.addressType === 'Both')
      .map(a => ({
        value: a.id,
        label: `${a.label} — ${a.line1}, ${a.city} ${a.state} ${a.postalCode}`.trim(),
      }));
    return [{ value: null, label: this.translate.instant('common.none') }, ...opts];
  });

  constructor() {
    effect(() => {
      const id = this.salesOrderId();
      if (id) {
        this.loadDetail(id);
      }
    });
  }

  private loadDetail(id: number): void {
    this.loading.set(true);
    this.soService.getSalesOrderById(id).subscribe({
      next: (detail) => {
        this.so.set(detail);
        this.loading.set(false);
        this.loadDocuments(id);
        this.loadInvoices(id);
        // Load the acceptance list up front (when the feature is on) so the
        // Confirm button can pre-empt release before the user opens the tab.
        if (this.acceptanceCapEnabled()) this.loadAcceptances(id);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadDocuments(id: number): void {
    this.soService.getDocuments(id).subscribe({
      next: (docs) => this.documents.set(docs),
    });
  }

  private loadInvoices(id: number): void {
    this.soService.getInvoices(id).subscribe({
      next: (invs) => this.invoices.set(invs),
    });
  }

  // --- Invoice creation (standalone accounting mode only) ---
  protected openCreateInvoice(): void {
    if (!this.isStandalone()) return;
    this.showCreateInvoiceDialog.set(true);
  }

  protected closeCreateInvoice(): void {
    this.showCreateInvoiceDialog.set(false);
  }

  protected onInvoiceCreated(): void {
    this.showCreateInvoiceDialog.set(false);
    this.loadInvoices(this.salesOrderId());
    this.changed.emit();
  }

  protected switchTab(tab: TabId): void {
    this.activeTab.set(tab);
    if (tab === 'schedule' && this.scheduleMilestones().length === 0) {
      this.loadSchedule(this.salesOrderId());
    } else if (tab === 'stages' && this.stages() === null) {
      this.loadStages(this.salesOrderId());
    } else if (tab === 'customer-po' && this.customerPo() === null) {
      this.loadCustomerPo(this.salesOrderId());
    } else if (tab === 'acceptance') {
      this.loadAcceptances(this.salesOrderId());
    }
  }

  // --- Customer acceptance ---
  private loadAcceptances(id: number): void {
    this.acceptanceLoading.set(true);
    this.acceptanceService.list(id).subscribe({
      next: (list) => { this.acceptances.set(list); this.acceptanceLoading.set(false); },
      error: () => this.acceptanceLoading.set(false),
    });
  }

  protected openRecordDialog(): void {
    this.recordForm.reset({ method: 'ManualUpload', note: '' });
    this.recordFile.set(null);
    this.showRecordDialog.set(true);
  }

  protected onRecordFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.recordFile.set(input.files?.[0] ?? null);
  }

  protected saveRecord(): void {
    const so = this.so();
    if (!so || this.recordForm.invalid) return;
    const method = this.recordForm.controls.method.value;
    const file = this.recordFile();
    if (method !== 'Verbal' && !file) return;
    this.savingAcceptance.set(true);
    this.acceptanceService.record(so.id, {
      method,
      note: this.recordForm.controls.note.value,
      file: file ?? undefined,
    }).subscribe({
      next: () => {
        this.savingAcceptance.set(false);
        this.showRecordDialog.set(false);
        this.loadAcceptances(so.id);
        this.snackbar.success(this.translate.instant('salesOrders.acceptance.recorded'));
      },
      error: () => this.savingAcceptance.set(false),
    });
  }

  protected openSignatureDialog(): void {
    this.signatureForm.reset({ signerName: '', signerEmail: '' });
    this.signatureSubmitUrl.set(null);
    this.showSignatureDialog.set(true);
  }

  protected sendSignature(): void {
    const so = this.so();
    if (!so || this.signatureForm.invalid) return;
    this.savingAcceptance.set(true);
    this.acceptanceService.sendSignature(so.id, this.signatureForm.getRawValue()).subscribe({
      next: (res) => {
        this.savingAcceptance.set(false);
        this.signatureSubmitUrl.set(res.submitUrl);
        this.loadAcceptances(so.id);
        this.snackbar.success(this.translate.instant('salesOrders.acceptance.signatureSent'));
      },
      error: () => this.savingAcceptance.set(false),
    });
  }

  protected openPortalDialog(): void {
    this.portalForm.reset({ recipientEmail: '', verificationKey: '', validDays: null });
    this.portalLink.set(null);
    this.showPortalDialog.set(true);
  }

  protected requestPortal(): void {
    const so = this.so();
    if (!so || this.portalForm.invalid) return;
    const v = this.portalForm.getRawValue();
    this.savingAcceptance.set(true);
    this.acceptanceService.requestPortal(so.id, {
      recipientEmail: v.recipientEmail,
      verificationKey: v.verificationKey,
      validDays: v.validDays ?? undefined,
    }).subscribe({
      next: (res) => {
        this.savingAcceptance.set(false);
        this.portalLink.set(`${window.location.origin}/accept/${res.token}`);
        this.loadAcceptances(so.id);
        this.snackbar.success(this.translate.instant('salesOrders.acceptance.portalLinkCreated'));
      },
      error: () => this.savingAcceptance.set(false),
    });
  }

  protected openEmailIngestDialog(): void {
    this.emailIngestForm.reset({ fromEmail: '', note: '' });
    this.showEmailIngestDialog.set(true);
  }

  protected registerInboundEmail(): void {
    const so = this.so();
    if (!so || this.emailIngestForm.invalid) return;
    this.savingAcceptance.set(true);
    this.acceptanceService.emailIngest(so.id, {
      fromEmail: this.emailIngestForm.controls.fromEmail.value,
      note: this.emailIngestForm.controls.note.value || undefined,
    }).subscribe({
      next: () => {
        this.savingAcceptance.set(false);
        this.showEmailIngestDialog.set(false);
        this.loadAcceptances(so.id);
        this.snackbar.success(this.translate.instant('salesOrders.acceptance.emailRegistered'));
      },
      error: () => this.savingAcceptance.set(false),
    });
  }

  protected checkSignature(a: SalesOrderAcceptance): void {
    const so = this.so();
    if (!so) return;
    this.acceptanceService.checkSignature(so.id, a.id).subscribe({
      next: () => this.loadAcceptances(so.id),
    });
  }

  protected confirmEmail(a: SalesOrderAcceptance): void {
    const so = this.so();
    if (!so) return;
    this.acceptanceService.confirmEmail(so.id, a.id).subscribe({
      next: () => {
        this.loadAcceptances(so.id);
        this.snackbar.success(this.translate.instant('salesOrders.acceptance.emailConfirmed'));
      },
    });
  }

  protected revokeAcceptance(a: SalesOrderAcceptance): void {
    const so = this.so();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.acceptance.revokeTitle'),
        message: this.translate.instant('salesOrders.acceptance.revokeMessage'),
        confirmLabel: this.translate.instant('salesOrders.acceptance.revoke'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.acceptanceService.revoke(so.id, a.id, this.translate.instant('salesOrders.acceptance.revokeReason')).subscribe({
        next: () => {
          this.loadAcceptances(so.id);
          this.snackbar.success(this.translate.instant('salesOrders.acceptance.revoked'));
        },
      });
    });
  }

  protected copyToClipboard(value: string | null): void {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    this.snackbar.success(this.translate.instant('salesOrders.acceptance.linkCopied'));
  }

  protected downloadAcceptanceFile(a: SalesOrderAcceptance): void {
    if (a.fileAttachmentId) window.open(this.soService.downloadFileUrl(a.fileAttachmentId), '_blank');
  }

  protected acceptanceStatusClass(status: string): string {
    const map: Record<string, string> = {
      Accepted: 'chip--success',
      Pending: 'chip--warning',
      Declined: 'chip--error',
      Revoked: 'chip--error',
      Expired: 'chip--muted',
    };
    return `chip ${map[status] ?? 'chip--muted'}`.trim();
  }

  protected acceptanceMethodLabel(method: string): string {
    const key = 'salesOrders.acceptance.method' + method;
    const t = this.translate.instant(key);
    return t !== key ? t : method;
  }

  protected acceptanceStatusLabel(status: string): string {
    const key = 'salesOrders.acceptance.status' + status;
    const t = this.translate.instant(key);
    return t !== key ? t : status;
  }

  // --- S4c: staged schedule ---
  private loadStages(id: number): void {
    this.stagesLoading.set(true);
    this.soService.getStages(id).subscribe({
      next: (s) => { this.stages.set(s); this.stagesLoading.set(false); },
      error: () => this.stagesLoading.set(false),
    });
  }

  protected activateStagedSchedule(): void {
    this.stagesLoading.set(true);
    this.soService.activateStagedSchedule(this.salesOrderId()).subscribe({
      next: (s) => {
        this.stages.set(s);
        this.stagesLoading.set(false);
        this.snackbar.success(this.translate.instant('salesOrders.stages.activated'));
      },
      error: () => this.stagesLoading.set(false),
    });
  }

  protected completeStage(stageId: number): void {
    this.soService.completeStage(stageId).subscribe({ next: () => this.loadStages(this.salesOrderId()) });
  }

  protected shipStage(stageId: number): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.stages.shipTitle'),
        message: this.translate.instant('salesOrders.stages.shipMessage'),
        confirmLabel: this.translate.instant('salesOrders.stages.ship'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.soService.shipStage(stageId).subscribe({
        next: () => { this.loadStages(this.salesOrderId()); this.changed.emit(); },
      });
    });
  }

  protected openShipDialog(): void {
    this.showShipDialog.set(true);
  }

  protected onShipCreated(): void {
    this.showShipDialog.set(false);
    this.loadDetail(this.salesOrderId());
    this.changed.emit();
  }

  protected stageStatusClass(status: string): string {
    const map: Record<string, string> = {
      Planned: 'chip--muted', InProduction: 'chip--info', ReadyToShip: 'chip--warning',
      Shipped: 'chip--success', Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  // --- S4a: customer-PO document ---
  private loadCustomerPo(id: number): void {
    this.customerPoLoading.set(true);
    this.soService.getCustomerPo(id).subscribe({
      next: (doc) => { this.customerPo.set(doc); this.customerPoLoading.set(false); },
      error: () => this.customerPoLoading.set(false),
    });
  }

  protected generateCustomerPo(): void {
    this.customerPoLoading.set(true);
    this.soService.generateCustomerPo(this.salesOrderId()).subscribe({
      next: () => {
        this.loadCustomerPo(this.salesOrderId());
        this.snackbar.success(this.translate.instant('salesOrders.customerPoDoc.generated'));
      },
      error: () => this.customerPoLoading.set(false),
    });
  }

  protected downloadCustomerPoPdf(): void {
    window.open(this.soService.customerPoPdfUrl(this.salesOrderId()), '_blank');
  }

  private loadSchedule(id: number): void {
    this.scheduleLoading.set(true);
    this.soService.getSchedule(id).subscribe({
      next: (milestones) => {
        this.scheduleMilestones.set(milestones);
        this.scheduleLoading.set(false);
      },
      error: () => this.scheduleLoading.set(false),
    });
  }

  protected toggleLineExpand(lineId: number): void {
    const current = new Set(this.expandedLines());
    if (current.has(lineId)) {
      current.delete(lineId);
    } else {
      current.add(lineId);
    }
    this.expandedLines.set(current);
  }

  protected isLineExpanded(lineId: number): boolean {
    return this.expandedLines().has(lineId);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected confirmSo(): void {
    const so = this.so();
    if (!so) return;
    // Pre-empt the server's 409 — no release until a customer acceptance is on file.
    if (this.confirmBlockedByAcceptance()) return;
    this.soService.confirmSalesOrder(so.id).subscribe({
      next: () => {
        this.loadDetail(so.id);
        this.changed.emit();
        this.snackbar.success(this.translate.instant('salesOrders.soConfirmed'));
      },
    });
  }

  protected cancelSo(): void {
    const so = this.so();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.cancelSoTitle'),
        message: this.translate.instant('salesOrders.cancelSoMessage', { number: so.orderNumber }),
        confirmLabel: this.translate.instant('salesOrders.cancelOrder'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.cancelSalesOrder(so.id).subscribe({
        next: () => {
          this.loadDetail(so.id);
          this.changed.emit();
          this.snackbar.success(this.translate.instant('salesOrders.soCancelled'));
        },
      });
    });
  }

  protected deleteSo(): void {
    const so = this.so();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.deleteSoTitle'),
        message: this.translate.instant('salesOrders.deleteSoMessage', { number: so.orderNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.deleteSalesOrder(so.id).subscribe({
        next: () => {
          this.changed.emit();
          this.closed.emit();
          this.snackbar.success(this.translate.instant('salesOrders.soDeleted'));
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Confirmed: 'chip--primary',
      InProduction: 'chip--info',
      PartiallyShipped: 'chip--warning',
      Shipped: 'chip--success',
      Completed: 'chip--success',
      Cancelled: 'chip--error',
      Pending: 'chip--muted',
      Packed: 'chip--info',
      InTransit: 'chip--warning',
      Delivered: 'chip--success',
      Received: 'chip--muted',
      UnderInspection: 'chip--info',
      ReworkOrdered: 'chip--warning',
      Resolved: 'chip--success',
      Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'salesOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected getPriorityClass(priority: string | null): string {
    const map: Record<string, string> = {
      Low: 'chip--muted',
      Normal: 'chip--info',
      High: 'chip--warning',
      Critical: 'chip--error',
    };
    return `chip ${map[priority ?? ''] ?? ''}`.trim();
  }

  protected isLineWarning(line: SalesOrderLine): boolean {
    return this.linesWithNoJobs().some(l => l.id === line.id);
  }

  protected canConfirm(status: string): boolean { return status === 'Draft'; }
  protected canCancel(status: string): boolean { return status === 'Draft' || status === 'Confirmed'; }

  /**
   * F8 change control: a locked order (anything past Draft, not Cancelled)
   * takes changes via a linked Draft addendum instead of edits. The server
   * additionally rejects chaining addenda off addenda.
   */
  protected canCreateAddendum(so: SalesOrderDetail): boolean {
    return so.status !== 'Draft' && so.status !== 'Cancelled';
  }

  protected createAddendum(): void {
    const so = this.so();
    if (!so) return;
    this.soService.createAddendum(so.id).subscribe({
      next: (created) => {
        this.snackbar.success(this.translate.instant('salesOrders.addendumCreated', { number: created.orderNumber }));
        this.changed.emit();
      },
    });
  }
  protected canDelete(status: string): boolean { return status === 'Draft'; }

  // --- Line editing ---
  protected canEditLines(status: string): boolean { return status === 'Draft'; }

  protected startAddLine(): void {
    this.lineForm.reset({ partId: null, description: '', quantity: 1, unitPrice: 0 });
    this.editingLineId.set(0);
  }

  protected editLine(line: SalesOrderLine): void {
    this.lineForm.reset({
      partId: line.partId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    });
    this.editingLineId.set(line.id);
  }

  protected cancelLineEdit(): void {
    this.editingLineId.set(null);
  }

  /** Prefill description + customer-specific unit price from the chosen catalog part. */
  protected onPartSelected(part: Record<string, unknown> | null): void {
    if (!part) return;
    const name = (part['name'] as string) ?? '';
    if (name && !this.lineForm.controls.description.value) {
      this.lineForm.controls.description.setValue(name);
    }
    // #26: pre-populate the row's unit price from the customer's price list when a
    // catalog part is picked. Leaves the field for manual entry when no price resolves.
    const so = this.so();
    const partId = part['id'] as number | undefined;
    if (so && partId) {
      this.soService.resolvePrice(so.customerId, partId).subscribe({
        next: price => {
          if (price != null) this.lineForm.controls.unitPrice.setValue(price);
        },
        error: () => { /* price stays manual-entry; global interceptor surfaces hard errors */ },
      });
    }
  }

  protected saveLine(): void {
    const so = this.so();
    const editing = this.editingLineId();
    if (!so || editing === null || this.lineForm.invalid) return;
    const v = this.lineForm.getRawValue();
    this.savingLine.set(true);
    const req = editing === 0
      ? this.soService.addSalesOrderLine(so.id, {
          partId: v.partId ?? undefined,
          description: v.description,
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        })
      : this.soService.updateSalesOrderLine(so.id, editing, {
          description: v.description,
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        });
    req.subscribe({
      next: (detail) => {
        this.so.set(detail);
        this.editingLineId.set(null);
        this.savingLine.set(false);
        this.changed.emit();
        this.snackbar.success(this.translate.instant(editing === 0 ? 'salesOrders.lineAdded' : 'salesOrders.lineUpdated'));
      },
      error: () => this.savingLine.set(false),
    });
  }

  protected startEditHeader(): void {
    const so = this.so();
    if (!so) return;
    this.headerForm.reset({
      customerPO: so.customerPO ?? '',
      creditTerms: so.creditTerms ?? null,
      requestedDeliveryDate: so.requestedDeliveryDate ? new Date(so.requestedDeliveryDate) : null,
      billingAddressId: so.billingAddressId ?? null,
    });
    this.loadCustomerAddresses(so.customerId);
    this.editingHeader.set(true);
  }

  private loadCustomerAddresses(customerId: number): void {
    this.soService.getCustomerAddresses(customerId).subscribe({
      next: (addresses) => this.customerAddresses.set(addresses),
      error: () => this.customerAddresses.set([]),
    });
  }

  protected cancelHeaderEdit(): void {
    this.editingHeader.set(false);
  }

  protected saveHeader(): void {
    const so = this.so();
    if (!so) return;
    const v = this.headerForm.getRawValue();
    this.savingHeader.set(true);
    // `|| undefined` so a blank field is omitted rather than sent — the server only
    // applies non-null fields, and an empty creditTerms string would fail enum-parse.
    this.soService.updateSalesOrder(so.id, {
      customerPO: v.customerPO || undefined,
      creditTerms: v.creditTerms || undefined,
      requestedDeliveryDate: toIsoDate(v.requestedDeliveryDate) || undefined,
      billingAddressId: v.billingAddressId ?? undefined,
    }).subscribe({
      next: () => {
        this.savingHeader.set(false);
        this.editingHeader.set(false);
        this.loadDetail(so.id);
        this.changed.emit();
        this.snackbar.success(this.translate.instant('salesOrders.headerUpdated'));
      },
      error: () => this.savingHeader.set(false),
    });
  }

  protected deleteLine(line: SalesOrderLine): void {
    const so = this.so();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.deleteLineTitle'),
        message: this.translate.instant('salesOrders.deleteLineMessage', { description: line.description }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.deleteSalesOrderLine(so.id, line.id).subscribe({
        next: (detail) => {
          this.so.set(detail);
          this.changed.emit();
          this.snackbar.success(this.translate.instant('salesOrders.lineRemoved'));
        },
      });
    });
  }

  // --- Documents ---
  protected downloadFile(doc: FileAttachment): void {
    window.open(this.soService.downloadFileUrl(doc.id), '_blank');
  }

  protected deleteFile(doc: FileAttachment): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.deleteFileTitle'),
        message: this.translate.instant('salesOrders.deleteFileMessage', { name: doc.fileName }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.deleteFile(doc.id).subscribe({
        next: () => {
          this.documents.update(list => list.filter(f => f.id !== doc.id));
          this.snackbar.success(this.translate.instant('salesOrders.fileDeleted'));
        },
      });
    });
  }

  protected onFileUploaded(_file: UploadedFile): void {
    this.loadDocuments(this.salesOrderId());
    this.snackbar.success(this.translate.instant('salesOrders.fileUploaded'));
  }

  protected getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('document') || contentType.includes('word')) return 'description';
    return 'attach_file';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // --- Invoices ---
  protected getInvoiceStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      Paid: 'chip--success',
      Overdue: 'chip--error',
      Cancelled: 'chip--error',
      PartiallyPaid: 'chip--warning',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }
}
