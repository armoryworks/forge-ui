import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { RETURN_DISPOSITIONS } from '../../models/return-dispositions.const';
import { ResolveCustomerReturnRequest } from '../../models/resolve-customer-return-request.model';

@Component({
  selector: 'app-customer-return-detail-panel',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    TranslatePipe,
    MatTooltipModule,
    EntityActivitySectionComponent,
    DialogComponent,
    TextareaComponent,
    LoadingBlockDirective,
    DetailLoadErrorComponent,
    SelectComponent,
    InputComponent,
    ToggleComponent,
    RouterLink,
  ],
  templateUrl: './customer-return-detail-panel.component.html',
  styleUrl: './customer-return-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnDetailPanelComponent {
  private readonly service = inject(CustomerReturnService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly capabilities = inject(CapabilityService);
  private readonly inventory = inject(InventoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customerReturnId = input.required<number>();
  readonly closed = output<void>();
  readonly updated = output<void>();

  protected readonly detail = signal<CustomerReturnDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<unknown>(null);
  protected readonly showResolveDialog = signal(false);
  protected readonly resolveSaving = signal(false);

  protected readonly resolveForm = new FormGroup({
    inspectionNotes: new FormControl('', [Validators.maxLength(1000)]),
    disposition: new FormControl<string | null>(null),
    quantity: new FormControl<number | null>(null, [Validators.min(0.0001)]),
    restockLocationId: new FormControl<number | null>(null),
    lotNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    issueCredit: new FormControl<boolean>(true, { nonNullable: true }),
    creditAmount: new FormControl<number | null>(null, [Validators.min(0)]),
    restockingFeePercent: new FormControl<number | null>(null, [Validators.min(0), Validators.max(100)]),
  });

  protected readonly locationOptions = signal<SelectOption[]>([]);
  protected readonly dispositionOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('customerReturns.dispositionNone') },
    ...RETURN_DISPOSITIONS.map(d => ({ value: d, label: this.translate.instant(`customerReturns.disposition.${d}`) })),
  ];
  protected readonly selectedDisposition = signal<string | null>(null);
  protected readonly canIssueCredit = computed(() => {
    const r = this.detail();
    return !!r && !r.channelId;
  });

  constructor() {
    this.resolveForm.controls.disposition.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.selectedDisposition.set(value));
    effect(() => {
      const id = this.customerReturnId();
      if (id) {
        this.loadDetail(id);
      }
    });
  }

  private loadDetail(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: (err: unknown) => { this.loading.set(false); this.loadError.set(err); },
    });
  }

  protected openResolve(): void {
    const r = this.detail();
    this.resolveForm.reset({
      inspectionNotes: '', disposition: null, quantity: r?.quantity ?? null, restockLocationId: null,
      lotNumber: '', issueCredit: true, creditAmount: null, restockingFeePercent: null,
    });
    this.selectedDisposition.set(null);
    if (this.locationOptions().length === 0) {
      this.inventory.getAllActiveBinLocations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: bins => this.locationOptions.set(bins.map(b => ({ value: b.id, label: b.locationPath || b.name }))),
      });
    }
    this.showResolveDialog.set(true);
  }

  protected resolveBlocked(): boolean {
    const f = this.resolveForm.getRawValue();
    if (this.resolveForm.invalid) return true;
    if (!f.disposition) return false;
    if (!(f.quantity && f.quantity > 0)) return true;
    if (f.disposition === 'ReturnToStock' && !f.restockLocationId) return true;
    return f.disposition === 'ReturnToStock' && this.detail()?.partLotTracked === true && !f.lotNumber.trim();
  }

  protected closeResolveDialog(): void {
    this.showResolveDialog.set(false);
  }

  protected resolve(): void {
    const r = this.detail();
    if (!r) return;
    this.resolveSaving.set(true);
    const f = this.resolveForm.getRawValue();
    const notes = f.inspectionNotes || undefined;
    const disposition: ResolveCustomerReturnRequest | undefined = f.disposition
      ? {
        disposition: f.disposition,
        quantity: f.quantity,
        restockLocationId: f.disposition === 'ReturnToStock' ? f.restockLocationId : null,
        lotNumber: f.disposition === 'ReturnToStock' ? (f.lotNumber.trim() || null) : null,
        issueCredit: this.creditsEnabled() && this.canIssueCredit() && f.issueCredit,
        creditAmount: f.creditAmount,
        restockingFeePercent: f.restockingFeePercent,
      }
      : undefined;
    this.service.resolve(r.id, notes, disposition).subscribe({
      next: () => {
        this.loadDetail(r.id);
        this.resolveSaving.set(false);
        this.closeResolveDialog();
        this.snackbar.success(this.translate.instant('customerReturns.resolved'));
        this.updated.emit();
      },
      error: () => this.resolveSaving.set(false),
    });
  }

  protected creditsEnabled(): boolean {
    return this.capabilities.isEnabled('CAP-O2C-RMA');
  }

  protected closeReturn(r: CustomerReturnDetail): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customerReturns.closeTitle'),
        message: this.translate.instant('customerReturns.closeMessage', { number: r.returnNumber }),
        confirmLabel: this.translate.instant('customerReturns.closeConfirm'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.close(r.id).subscribe({
        next: () => {
          this.loadDetail(r.id);
          this.snackbar.success(this.translate.instant('customerReturns.closed'));
          this.updated.emit();
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Received: 'chip--info',
      ReworkOrdered: 'chip--warning',
      InInspection: 'chip--primary',
      Resolved: 'chip--success',
      Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      ReworkOrdered: 'Rework Ordered',
      InInspection: 'In Inspection',
    };
    return labels[status] ?? status;
  }
}
